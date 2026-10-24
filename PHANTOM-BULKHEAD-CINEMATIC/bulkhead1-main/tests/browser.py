"""End-to-end browser acceptance against a disposable Compose deployment.

Run: python tests/browser.py
Requires Playwright Chromium, running API/worker/database and local Mailpit.
Creates a unique account and private test household; never uses existing data.
"""
import json
import os
import re
import time
from pathlib import Path
from urllib.request import urlopen
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect

ORIGIN=os.environ.get('BULKHEAD_BROWSER_ORIGIN','http://localhost:8080')
MAILPIT=os.environ.get('BULKHEAD_MAILPIT_ORIGIN','http://localhost:8025')
EMAIL=f'browser-{uuid4()}@example.com'
PASSWORD='Browser fixture correct horse '+str(uuid4())


def verification_token():
    deadline=time.monotonic()+30
    while time.monotonic()<deadline:
        with urlopen(MAILPIT+'/api/v1/messages',timeout=5) as response: messages=json.load(response)
        for message in messages.get('messages',[]):
            if any(recipient.get('Address','')==EMAIL for recipient in message.get('To',[])):
                with urlopen(MAILPIT+'/api/v1/message/'+message['ID'],timeout=5) as response: detail=json.load(response)
                match=re.search(r'token=([^\s<]+)',detail.get('Text',''))
                if match: return match.group(1)
        time.sleep(.5)
    raise AssertionError('Verification email was not delivered to Mailpit')


with sync_playwright() as p:
    options={'headless':True}
    if os.environ.get('BULKHEAD_CHROMIUM'): options['executable_path']=os.environ['BULKHEAD_CHROMIUM']
    browser=p.chromium.launch(**options)
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(ORIGIN+'/#/register')
    page.get_by_label('Email',exact=True).fill(EMAIL)
    page.get_by_label('Password (at least 12 characters)').fill(PASSWORD)
    page.get_by_role('button',name='Create account',exact=True).click()
    expect(page.get_by_role('status')).to_contain_text('verification email')
    token=verification_token()
    page.goto(ORIGIN+'/#/verify?token='+token)
    page.get_by_role('button',name='Verify email',exact=True).click()
    expect(page.get_by_role('status')).to_contain_text('Email verified')
    page.goto(ORIGIN+'/#/login')
    page.get_by_label('Email',exact=True).fill(EMAIL)
    page.get_by_label('Password (at least 12 characters)').fill(PASSWORD)
    page.get_by_role('button',name='Sign in',exact=True).click()
    page.get_by_label('Household name').fill('Browser acceptance')
    page.get_by_role('button',name='Create household',exact=True).click()
    expect(page.locator('.network-node-card')).to_have_count(12)
    expect(page.locator('.workspace-toolbar__status')).to_contain_text('worker healthy',timeout=15000)
    nav=page.get_by_role('navigation',name='Main navigation')
    expect(nav.get_by_role('link')).to_have_count(9)
    expect(page.get_by_role('navigation',name='Footer navigation').get_by_role('link')).to_have_count(9)
    for route in ('Home','Network','Access health','Alerts','Timeline','Devices','Policies','Household','Simulation'):
        nav.get_by_role('link',name=route,exact=True).click()
        expect(nav.get_by_role('link',name=route,exact=True)).to_have_attribute('aria-current','page')
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),route
    for theme in ('Mint','Glacier','Cobalt','Ember','Orchid'):
        page.get_by_role('button',name=re.compile('Choose color theme')).click()
        page.get_by_role('button',name=re.compile('^'+theme)).click()
        expect(page.locator('html')).to_have_attribute('data-theme',theme.lower())
    group=page.get_by_role('group',name='Response profile')
    for profile in ('Admin','Family','Work','Solo'):
        group.get_by_role('button',name=profile,exact=True).click()
        expect(group.get_by_role('button',name=profile,exact=True)).to_have_attribute('aria-pressed','true')
    page.reload()
    expect(page.get_by_role('group',name='Response profile').get_by_role('button',name='Solo')).to_have_attribute('aria-pressed','true')
    page.get_by_role('button',name='Scenario B: Stolen Creds',exact=True).click()
    nav.get_by_role('link',name='Alerts',exact=True).click()
    confirmation=page.get_by_role('button',name='Confirm simulated account revocation')
    expect(confirmation.first).to_be_visible(timeout=15000)
    confirmation.first.click()
    expect(page.get_by_text('REVOKE · verified · simulation',exact=True).first).to_be_visible()
    page.get_by_role('button',name='Undo and recover access').first.click()
    expect(page.get_by_text('REVOKE · rolled_back · simulation',exact=True).first).to_be_visible()
    page.get_by_role('button',name='Acknowledge',exact=True).first.click()
    page.get_by_role('button',name='Resolve incident',exact=True).first.click()
    nav.get_by_role('link',name='Timeline',exact=True).click()
    expect(page.get_by_text('action · rolled_back',exact=True).first).to_be_visible()
    nav.get_by_role('link',name='Simulation',exact=True).click()
    page.get_by_role('button',name='Reset Simulation').click()
    expect(page.get_by_role('status')).to_contain_text('Scenario stopped')
    household=page.locator('#active-household').input_value()
    page.get_by_role('button',name='Scenario C: Benign Update',exact=True).click()
    current=page.request.get(ORIGIN+f'/api/v1/households/{household}/state').json()
    page.wait_for_function('''async ({url,tick}) => (await (await fetch(url)).json()).tick >= tick+2''',arg={'url':f'/api/v1/households/{household}/state','tick':current['tick']},timeout=15000)
    after=page.request.get(ORIGIN+f'/api/v1/households/{household}/state').json()
    assert len(after['incidents'])==len(current['incidents']),'Benign vendor update created an incident'
    page.get_by_role('button',name='Reset Simulation').click()
    page.get_by_role('group',name='Response profile').get_by_role('button',name='Admin',exact=True).click()
    page.get_by_role('button',name='Scenario A: Compromised Plug',exact=True).click()
    nav.get_by_role('link',name='Alerts',exact=True).click()
    expect(page.get_by_text('CONTAIN · verified · simulation',exact=True).first).to_be_visible(timeout=15000)
    # Failed audit reads must not present an empty successful result.
    page.route('**/api/v1/households/*/audit',lambda route:route.fulfill(status=503,content_type='application/json',body='{"detail":"Injected audit failure"}'))
    nav.get_by_role('link',name='Access health',exact=True).click()
    expect(page.get_by_role('alert').filter(has_text='Audit unavailable')).to_be_visible()
    expect(page.get_by_text('No simulated access findings',exact=True)).to_have_count(0)
    page.unroute('**/api/v1/households/*/audit')
    page.get_by_role('button',name='Retry',exact=True).click()
    expect(page.get_by_role('heading',name='Security Findings')).to_be_visible()
    nav.get_by_role('link',name='Network',exact=True).click()
    page.locator('.network-node-name').filter(has_text='Smart Plug').click()
    page.locator('.network-node-name').filter(has_text='Work Laptop').click()
    expect(page.locator('.map-analysis-name')).to_have_text('Work Laptop')
    for width in (390,768,1440):
        page.set_viewport_size({'width':width,'height':1000})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    Path('test-results').mkdir(exist_ok=True)
    page.screenshot(path='test-results/bulkhead-network.png',full_page=True)
    assert not errors,errors
    browser.close()
print('PASS: signup, verification, login, onboarding, pages, themes, profiles, scenarios, incident actions, undo, audit failure, graph selection and responsive layout')
