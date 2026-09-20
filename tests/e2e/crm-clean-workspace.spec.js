const { test, expect } = require('@playwright/test');
test.setTimeout(180000);
test.use({ viewport: { width: 1440, height: 900 }, screenshot: 'off', trace: 'off', video: 'off' });

async function evidence(page, name) {
  // Keep layout evidence, without publishing customer identities or notes.
  await page.screenshot({ path: test.info().outputPath(name + '.png'), mask: [
    page.locator('#salesBoard .oppInfo, #salesBoard .oppTitle, #salesListRows .salesIdentity, #salesListRows .salesContact'),
    page.locator('#contactModal .cpData, #cpProfileIdentityText, #contactName, #cpAvatar, #tpfGoogleInlineCard p, #cpTimeline, .tpfRecentActivity > div'),
    page.locator('#oppDetailModal input, #oppDetailModal textarea, #oppDetailModal .crmOpportunitySummary dd, #oppDetailModal .tpfRelPersonBody, #oppDetailModal .tpfRelRecipient, #oppDetailModal [data-crm-contact-body]'),
    page.locator('#tpfContactsCreateBack input, #tpfContactsCreateBack textarea, #tpfContactsCreateBack .tpfContactsModalHead .small, #tpfContactParty, .referenceUser')
  ] });
}
async function insideViewport(locator, page) {
  await expect(locator).toBeVisible();
  const rect = await locator.boundingBox(), size = page.viewportSize();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(size.width + 1);
  expect(rect.y + rect.height).toBeLessThanOrEqual(size.height + 1);
}
test('normal, fullscreen, contact tabs and protected editor retain their controls', async ({ page, request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  const health = await response.json();
  expect(health.environment).toBe('preview');
  expect(health.branch).toBe('test/estable-clon-20260919-v2');
  expect(health.commit).toBe(process.env.E2E_EXPECTED_COMMIT);
  expect(Boolean(process.env.CRM_TEST_EMAIL && process.env.CRM_TEST_PASSWORD)).toBeTruthy();
  await page.goto('/');
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
  await page.locator('.nav[data-view="sales"]').first().click();
  await expect(page.locator('#view-sales')).toBeVisible();
  await expect(page.locator('#salesSearch')).toBeVisible();
  await expect(page.locator('#salesBoard .stage').first()).toBeVisible({ timeout: 30000 });
  for (const full of [false, true]) {
    if (full) await page.locator('#tpfBoardMode').click();
    await insideViewport(page.locator('#salesOptionsToggle'), page);
    await insideViewport(page.locator('#salesSummaryToggle'), page);
    await insideViewport(page.locator('#salesSearch'), page);
    await page.locator('#salesOptionsToggle').click();
    await expect(page.locator('#salesStageFilter')).toBeVisible();
    await expect(page.locator('#salesSort')).toBeVisible();
    await expect(page.locator('#newStage')).toBeVisible();
    await expect(page.locator('#newField')).toBeVisible();
    await page.locator('.tpfCleanFiltersFoot button').last().click();
    const expanded = await page.locator('#salesSummaryToggle').getAttribute('aria-expanded');
    await page.locator('#salesSummaryToggle').click();
    await expect(page.locator('#salesSummaryToggle')).toHaveAttribute('aria-expanded', expanded === 'true' ? 'false' : 'true');
    await evidence(page, full ? '02-tablero-completo' : '01-tablero-normal');
    await page.locator('#salesViewList').click();
    await expect(page.locator('#salesListView')).toBeVisible();
    await evidence(page, full ? '04-lista-completa' : '03-lista-normal');
    await page.locator('#salesViewBoard').click();
  }
  await page.locator('#tpfBoardMode').click();
  const opportunity = page.locator('#salesBoard .oppTitle').first();
  const contact = page.locator('#salesBoard .salesClientLink').first();
  if (!(await opportunity.count()) || !(await contact.count())) {
    test.info().annotations.push({ type: 'coverage-gap', description: 'Sin oportunidades/contactos en demo; dossier y editor no comprobados.' });
    return;
  }
  await opportunity.click();
  await expect(page.locator('#oppDetailModal')).toBeVisible();
  await insideViewport(page.locator('#oppModalSave'), page);
  await insideViewport(page.locator('#oppModalClose'), page);
  await expect(page.locator('.crmOpportunitySummary')).toBeVisible();
  await evidence(page, '05-oportunidad');
  await page.locator('#oppModalCloseX').click();
  await contact.click();
  await expect(page.locator('#contactModal')).toBeVisible();
  await expect(page.locator('#tpfContactEditToggle')).toBeVisible();
  for (const tab of ['oportunidades','tareas','notas','documentos','historial','resumen']) {
    await page.locator('#cpRefTab-' + tab).click();
    await expect(page.locator('#cpRefTab-' + tab)).toHaveAttribute('aria-selected', 'true');
  }
  await expect(page.locator('.tpfSummaryBody').first()).toBeHidden();
  await page.locator('.tpfSummaryTrigger').first().click();
  await expect(page.locator('.tpfSummaryBody').first()).toBeVisible();
  await page.locator('.tpfSummaryTrigger').first().click();
  await evidence(page, '06-contacto');
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#tpfContactsCreateBack.tpfContactEditor')).toBeVisible();
  await expect(page.locator('#tpfCreateNotes')).toHaveAttribute('readonly', '');
  await expect(page.locator('#tpfCreateObs')).toHaveAttribute('readonly', '');
  for (const size of [{width:1440,height:900},{width:1100,height:700}]) {
    await page.setViewportSize(size);
    await insideViewport(page.locator('#tpfContactsCreateSave'), page);
    await insideViewport(page.locator('#tpfContactsCreateCancel'), page);
    await evidence(page, '07-editor-' + size.width);
  }
  await page.locator('#tpfContactsCreateCancel').click();
  await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
});
