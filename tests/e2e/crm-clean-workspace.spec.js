const { test, expect } = require('@playwright/test');
test.setTimeout(180000);
test.use({ viewport: { width: 1440, height: 900 }, screenshot: 'off', trace: 'off', video: 'off' });

async function evidence(page, name) {
  // Capture only the active surface; masks on background panels can obscure a modal.
  let root = page.locator('#view-sales');
  for (const selector of ['#contactModal .contactProfile','#oppDetailModal .opportunityModalCard','#tpfContactsCreateBack .tpfContactsModal']) {
    const candidate = page.locator(selector);
    if (await candidate.isVisible()) root = candidate;
  }
  const personal = root.locator('input, textarea, .oppTitle, .oppInfo, .salesIdentity, .salesContact, #cpProfileIdentityText, #cpAvatar, #tpfGoogleInlineCard p, #cpTimeline, .tpfRecentActivity > div:not(.tpfRecentHeading), .crmOpportunitySummary dd, .crmSummaryNotes p, .tpfRelPersonBody, .tpfRelRecipient, [data-crm-contact="name"], [data-crm-contact="nickname"], [data-crm-contact-body], .tpfContactsModalHead .small, #tpfEditorAvatar, #tpfContactParty, #contactCustomFields, #contactLabelsList, #contactMeta, #tpfContactPartySummary [data-rel-cards], #tpfContactPartySummary [data-rel-managedby], .oppUnifiedTitle, .oppUnifiedClient, .oppUnifiedNotes, .cpAuthLine, .cpTaskButton b').filter({visible:true});
  await root.screenshot({ path: test.info().outputPath(name + '.png'), mask: [personal], maskColor: '#dce5ef' });
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
  const notes=page.locator('#salesBoard .tpfSalesNotes').first();
  if(await notes.count()){await notes.locator('summary').click();await expect(notes).toHaveAttribute('open','');await expect(page.locator('#oppDetailModal')).toBeHidden();await notes.locator('summary').click();}
  const copy=page.locator('#salesBoard .tpfCopyButton').first();
  if(await copy.count()){await copy.click();await expect(page.locator('#oppDetailModal')).toBeHidden();await expect(page.locator('#contactModal')).toBeHidden();}
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
  await expect(page.locator('#contactSave')).toBeHidden();
  await expect(page.locator('.tpfRecentActivity h3')).toBeVisible();
  await expect(page.locator('.tpfRecentActivity button')).toBeVisible();
  const dataBox=await page.locator('#contactModal .cpData').boundingBox();
  expect(dataBox.width).toBeGreaterThanOrEqual(320);
  expect(dataBox.width).toBeLessThan(490);
  const followBox=await page.locator('#contactModal .cpRight').boundingBox();
  expect(followBox.width).toBeGreaterThan(dataBox.width*1.5);
  const googleBox=await page.locator('#tpfGoogleInlineCard').boundingBox(),tabsBox=await page.locator('.cpRefTabs').boundingBox();
  expect(googleBox.y+googleBox.height).toBeLessThanOrEqual(tabsBox.y+1);
  await expect(page.locator('[data-tpf-summary-group="opportunities"] .tpfSummaryChip')).toHaveCount(2);
  await expect(page.locator('[data-tpf-summary-group="tasks"] .tpfSummaryChip')).toHaveCount(2);
  await expect(page.locator('#tpfContactPartySummary')).toBeVisible();
  await expect(page.locator('[data-tpf-summary-group="opportunities"] #cpSideNewOpp')).toBeVisible();
  await expect(page.locator('[data-tpf-summary-group="tasks"] #cpSideNewTask')).toBeVisible();
  const relationBox=await page.locator('#tpfContactPartySummary').boundingBox();
  expect(relationBox.y).toBeGreaterThanOrEqual(dataBox.y+dataBox.height);
  const opportunities=page.locator('[data-tpf-summary-group="opportunities"]');
  const tasks=page.locator('[data-tpf-summary-group="tasks"]');
  await opportunities.locator('.tpfSummaryTrigger').click();
  await tasks.locator('.tpfSummaryTrigger').click();
  const row=page.locator('#cpOpportunities > .oppUnifiedCard').first();
  if(await row.count()){
    expect((await row.boundingBox()).height).toBeLessThan(170);
    await expect(row.locator('select')).toBeVisible();
    await expect(row.locator('.oppUnifiedActions button').first()).toBeVisible();
    await row.locator('.tpfWorkDetails summary').click();
    await expect(row.locator('.tpfWorkDetails .danger')).toBeVisible();
    await row.locator('.tpfWorkDetails summary').click();
  }
  await page.locator('[data-task-filter="completed"]').click();
  await expect(page.locator('#cpTasks > [data-task-status="pending"]:visible')).toHaveCount(0);
  await page.locator('[data-task-filter="pending"]').click();
  await expect(page.locator('#cpTasks > [data-task-status="completed"]:visible')).toHaveCount(0);
  const pendingCount=await page.locator('#cpTasks > [data-task-status="pending"]').count();
  await expect(page.locator('#cpTasks > [data-task-status="pending"]:visible')).toHaveCount(Math.min(2,pendingCount));
  await page.locator('#cpRefTab-tareas').click();
  await expect(page.locator('#cpTasks > [data-task-status="pending"]:visible')).toHaveCount(pendingCount);
  await page.locator('#cpRefTab-resumen').click();
  await opportunities.locator('.tpfSummaryTrigger').click();
  await tasks.locator('.tpfSummaryTrigger').click();
  // Existing fields and copy actions stay aligned without modifying saved values.
  const phone=await page.locator('#contactPhone').boundingBox();
  const phoneCopy=page.locator('label[for="contactPhone"] .tpfCopyButton');
  if(await phoneCopy.isVisible()){
    const copyBox=await phoneCopy.boundingBox();expect(copyBox.x).toBeGreaterThan(phone.x+phone.width-35);
    await phoneCopy.click();await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
  }
  await evidence(page,'06-contacto-trabajo');
  await opportunities.locator('.tpfSummaryTrigger').click();
  await tasks.locator('.tpfSummaryTrigger').click();
  await evidence(page, '06-contacto');
  await page.locator('[data-tpf-summary-group="offers"] .tpfSummaryTrigger').click();
  await evidence(page,'06-contacto-ofertas');
  await page.locator('[data-tpf-summary-group="offers"] .tpfSummaryTrigger').click();
  await page.locator('#tpfContactEditToggle').click();
  await expect(page.locator('#tpfContactsCreateBack.tpfContactEditor')).toBeVisible();
  await expect(page.locator('#tpfCreateNotes')).toHaveAttribute('readonly', '');
  await expect(page.locator('#tpfCreateObs')).toHaveAttribute('readonly', '');
  expect((await page.locator('#tpfContactsCreateBack .tpfContactsModal').boundingBox()).height,'El editor debe ser compacto a 1440px').toBeLessThan(730);
  const note=page.locator('#tpfCreateNotes'),originalNote=await note.inputValue();
  await page.locator('.tpfEditorNote:has(#tpfCreateNotes) [data-note-unlock]').click();
  await expect(note).not.toHaveAttribute('readonly');
  await page.locator('.tpfEditorNote:has(#tpfCreateNotes) [data-note-restore]').click();
  await expect(note).toHaveAttribute('readonly','');
  expect((await note.inputValue())===originalNote).toBeTruthy();
  for (const size of [{width:1440,height:900},{width:1100,height:700}]) {
    await page.setViewportSize(size);
    await insideViewport(page.locator('#tpfContactsCreateSave'), page);
    await insideViewport(page.locator('#tpfContactsCreateCancel'), page);
    await evidence(page, '07-editor-' + size.width);
  }
  await page.locator('#tpfContactsCreateCancel').click();
  await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
});
