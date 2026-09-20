const { test, expect } = require('@playwright/test');
test.setTimeout(240000);
test.use({ viewport: { width: 1440, height: 900 }, screenshot: 'off', trace: 'off', video: 'off' });

async function evidence(page, name) {
  // Capture only the active surface; masks on background panels can obscure a modal.
  let root = await page.locator('#view-database').isVisible()?page.locator('#view-database'):page.locator('#view-sales');
  if(await page.locator('#tpfContactsApp.tpfContactsFull').isVisible())root=page.locator('#tpfContactsApp');
  for (const selector of ['#contactModal .contactProfile','#oppDetailModal .opportunityModalCard','#tpfContactsCreateBack .tpfContactsModal','.tpfOpportunityPicker:not([hidden]) .tpfPickerPanel']) {
    const candidate = page.locator(selector);
    if (await candidate.isVisible()) root = candidate;
  }
  const personal = root.locator('input, textarea, .tpfContactIdentity, #tpfContactsRows td:nth-child(3), #tpfContactsRows td:nth-child(4), #tpfContactsRows td:nth-child(6), .tpfPickerIdentity, .tpfPickerScroll td:first-child, .oppTitle, .oppInfo, .salesIdentity, .salesContact, #cpProfileIdentityText, #cpAvatar, #tpfGoogleInlineCard p, #cpTimeline, .tpfRecentActivity > div:not(.tpfRecentHeading), .crmOpportunitySummary dd, .crmSummaryNotes p, .tpfRelPersonBody, .tpfRelRecipient, [data-crm-contact="name"], [data-crm-contact="nickname"], [data-crm-contact-body], .tpfContactsModalHead .small, #tpfEditorAvatar, #tpfContactParty, #contactCustomFields, #contactLabelsList, #contactMeta, #tpfContactPartySummary [data-rel-cards], #tpfContactPartySummary [data-rel-managedby], .oppUnifiedTitle, .oppUnifiedClient, .oppUnifiedNotes, .tpfOpportunityNotesPreview, .tpfProfilePartyCard, .cpAuthLine, .cpTaskButton b').filter({visible:true});
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
  page.setDefaultTimeout(20000);
  await page.locator('.nav[data-view="database"]').first().click();
  await expect(page.locator('#tpfContactsRows tr').first()).toBeVisible({timeout:30000});
  await expect(page.locator('#tpfContactsMore')).toBeVisible();
  const statsBox=await page.locator('.tpfContactsStats').boundingBox();expect(statsBox.height).toBeLessThan(65);
  await page.locator('#tpfContactsMore').click();
  await expect(page.locator('#tpfContactsTools')).toBeVisible();
  await expect(page.locator('#tpfContactsFields')).toBeVisible();
  await expect(page.locator('#tpfContactsVerifyAll')).toBeVisible();
  await expect(page.locator('#tpfContactsExport')).toBeVisible();
  await evidence(page,'00-contactos-menu');
  await page.keyboard.press('Escape');
  await expect(page.locator('#tpfContactsTools')).toBeHidden();
  await page.locator('#tpfContactsFiltersToggle').click();
  await expect(page.locator('#tpfFilterDni')).toBeVisible();
  await page.locator('#tpfContactsFiltersClose').click();
  await page.locator('#tpfContactsSearch').fill('zzzz-sin-contactos-xyz');
  await expect(page.locator('#tpfContactsResultCount')).toHaveText('0 resultados');
  await page.locator('#tpfContactsSearch').fill('');
  await expect(page.locator('#tpfContactsRows tr').first()).toBeVisible();
  await page.locator('#tpfContactsRows .tpfContactActions').first().locator('button').last().click();
  await expect(page.locator('.tpfMoreMenu [data-list-schedule]')).toBeVisible();
  await expect(page.locator('.tpfMoreMenu [data-tpf-contact-offer]')).toBeVisible();
  await page.locator('.tpfContactsTitle').click();
  await evidence(page,'00-contactos-normal');
  // Exercise actual menu actions, not only the presence of their labels.
  for(const fullscreen of [false,true]){
    if(fullscreen)await page.locator('#tpfContactsExpand').click();
    const openMenu=async()=>{await page.locator('#tpfContactsRows .tpfContactActions').first().locator('button').last().click();};
    const before=await page.locator('#tpfContactsSearch').inputValue();
    await openMenu();
    await page.locator('.tpfMoreMenu [data-more="opp"]').click();
    await expect(page.locator('#oppDetailModal')).toBeVisible();
    await expect(page.locator('#oppModalClient')).not.toHaveValue('');
    await expect(page.locator('#oppModalOpenContact')).toHaveAttribute('data-record-id',/.+/);
    await page.locator('#oppModalClose').click();
    await expect(page.locator('#contactModal')).toBeHidden();
    await openMenu();
    await page.locator('.tpfMoreMenu [data-more="task"]').click();
    await expect(page.locator('#agendaCreateCard')).toBeVisible();
    await page.locator('#agendaCloseCreate').click();
    await expect(page.locator('#agendaCreateCard')).toBeHidden();
    for(const cancel of [false,true,'back']){
      await openMenu();
      await page.locator('.tpfMoreMenu [data-tpf-contact-offer]').click();
      await expect(page.locator('#opOfferModal')).toBeVisible();
      await expect(page.locator('#opContent .opCard').first()).toBeVisible();
      await expect(page.locator('#contactModal')).toBeHidden();
      if(cancel==='back'){await page.waitForTimeout(250);await page.goBack();}
      else if(cancel)await page.locator('#opOfferModal').getByRole('button',{name:'Cancelar',exact:true}).click();
      else await page.locator('#opOfferModal .opClose').click();
      await expect(page.locator('#opOfferModal')).toBeHidden();
      await expect(page.locator('#contactModal')).toBeHidden();
      await expect(page.locator('#tpfContactsSearch')).toHaveValue(before);
    }
    if(fullscreen){await expect(page.locator('#tpfContactsApp')).toHaveClass(/tpfContactsFull/);await page.locator('#tpfContactsExpand').click();}
  }

  await page.locator('#tpfContactsExpand').click();
  await expect(page.locator('#tpfContactsApp')).toHaveClass(/tpfContactsFull/);
  await insideViewport(page.locator('#tpfContactsNext'),page);
  await evidence(page,'00-contactos-completo');
  await expect(page.locator('.tpfOppOpen').first()).toBeVisible({timeout:30000});
  await page.locator('.tpfOppOpen').first().click();
  const picker=page.locator('.tpfOpportunityPicker');
  await expect(picker).toBeVisible();
  await expect(picker.locator('tbody tr').first()).toBeVisible();
  await picker.locator('[data-picker-search]').fill('zzzz-no-match');
  await expect(picker.locator('.tpfPickerEmpty')).toBeVisible();
  await picker.locator('[data-picker-search]').fill('');
  await picker.locator('[data-picker-filter="closed"]').click();
  await picker.locator('[data-picker-filter="all"]').click();
  await evidence(page,'00-oportunidades-contacto');
  await picker.locator('[data-picker-expand]').click();
  await expect(picker.locator('.tpfPickerPanel')).toHaveClass(/expanded/);
  await insideViewport(picker.locator('[data-picker-close]'),page);
  await picker.locator('[data-picker-expand]').click();
  await picker.locator('[data-picker-open]').first().click();
  await expect(page.locator('#oppDetailModal')).toBeVisible();
  await expect(picker).toBeHidden();
  await page.locator('#oppModalClose').click();
  await expect(picker).toBeVisible();
  await picker.locator('[data-picker-close]').click();
  await expect(picker).toHaveCount(0);
  await expect(page.locator('#tpfContactsApp')).toHaveClass(/tpfContactsFull/);
  await page.locator('#tpfContactsRows .tpfContactNameBtn').first().click();
  await expect(page.locator('#contactModal')).toBeVisible();
  await page.locator('#contactClose').click();
  await expect(page.locator('#contactModal')).toBeHidden();
  await page.locator('#tpfContactsExpand').click();
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
  await expect.poll(async()=>{
    const relationBox=await page.locator('#tpfContactPartySummary').boundingBox();
    const sourceBox=await page.locator('#tpfGoogleInlineCard').boundingBox();
    return !!relationBox&&!!sourceBox&&Math.abs(relationBox.y-sourceBox.y)<=2&&relationBox.x+relationBox.width<sourceBox.x;
  }).toBe(true);
  const relations=page.locator('#tpfContactPartySummary [data-rel-holders]');
  await expect(relations).not.toHaveAttribute('open');
  await relations.locator(':scope > summary').click();
  await expect(relations).toHaveAttribute('open','');
  await expect(page.locator('#tpfGoogleInlineCard details')).not.toHaveAttribute('open');
  await evidence(page,'06-titulares-desplegados');
  await relations.locator(':scope > summary').click();
  const googleDetails=page.locator('#tpfGoogleInlineCard details');
  await googleDetails.locator(':scope > summary').click();
  await expect(googleDetails).toHaveAttribute('open','');
  await expect(relations).not.toHaveAttribute('open');
  await evidence(page,'06-vinculacion-desplegada');
  await googleDetails.locator(':scope > summary').click();
  const recent=page.locator('.tpfRecentActivity');
  await expect(recent).not.toHaveAttribute('open');
  await recent.locator('h3').click();
  await expect(recent).toHaveAttribute('open','');
  await recent.locator('h3').click();
  await recent.locator('button').click();
  await expect(page.locator('#cpRefTab-historial')).toHaveAttribute('aria-selected','true');
  await page.locator('#cpRefTab-resumen').click();
  const menu=page.locator('.tpfContactMore');
  await menu.locator('summary').click();
  await expect(menu.locator('button')).toHaveCount(2);
  await expect(menu.locator('#cpNewOpp')).toBeVisible();
  await expect(menu.locator('#cpNewTask')).toBeVisible();
  await evidence(page,'06-menu-acciones');
  await menu.locator('summary').press('Escape');
  await expect(menu).not.toHaveAttribute('open');
  await expect(page.locator('#contactModal')).toBeVisible();
  await expect(page.locator('.cpData .contactLabelsBox')).toHaveCount(0);
  await expect(page.locator('.tpfStandaloneLabels #contactManageLabels')).toHaveText('+ Añadir etiqueta');
  const automation=page.locator('#cpAutomationStatus');
  await expect(automation).toHaveClass(/collapsed/);
  await expect(automation.locator('[data-cas-toggle]')).toBeVisible();
  await automation.locator('[data-cas-toggle]').click();
  await expect(automation.locator('.casPanelBody')).toBeVisible();
  await automation.locator('[data-cas-toggle]').click();
  const opportunities=page.locator('[data-tpf-summary-group="opportunities"]');
  const tasks=page.locator('[data-tpf-summary-group="tasks"]');
  await opportunities.locator('.tpfSummaryTrigger').click();
  await tasks.locator('.tpfSummaryTrigger').click();
  const row=page.locator('#cpOpportunities > .oppUnifiedCard').first();
  if(await row.count()){
    expect((await row.boundingBox()).height).toBeLessThan(300);
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
  await expect(page.locator('#cpTasks > [data-task-status="pending"]:visible')).toHaveCount(Math.min(4,pendingCount));
  await page.locator('#cpRefTab-tareas').click();
  await expect(page.locator('#cpTasks > [data-task-status="pending"]:visible')).toHaveCount(pendingCount);
  await page.locator('#cpRefTab-resumen').click();
  await opportunities.locator('.tpfSummaryTrigger').click();
  await tasks.locator('.tpfSummaryTrigger').click();
  // Existing fields and copy actions stay aligned without modifying saved values.
  const phone=await page.locator('#contactPhone').boundingBox();
  const phoneCopy=page.locator('label[for="contactPhone"] .tpfCopyButton');
  if(await phoneCopy.isVisible()){
    const copyBox=await phoneCopy.boundingBox();expect(copyBox.x).toBeGreaterThan(phone.x+phone.width-65);
    const pencilBox=await page.locator('[data-inline-field="contactPhone"]').boundingBox();
    expect(copyBox.x+copyBox.width).toBeLessThanOrEqual(pencilBox.x+1);
    await phoneCopy.click();await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
  }
  // Every field edits independently; no real contact data is saved in this check.
  for(const id of ['contactPhone','contactDni','contactObservations','contactNotes','contactBank','contactEmail']){
    const native=page.locator('#'+id), original=await native.inputValue();
    await page.locator('[data-inline-field="'+id+'"]').click();
    const editor=page.locator('.tpfInlineContactInput');
    await expect(editor).toHaveCount(1);
    await expect(editor).toBeEditable();
    await editor.fill(id==='contactEmail'?'prueba@example.com':'Prueba sin guardar');
    await expect(page.locator('#tpfContactsCreateBack')).toBeHidden();
    if(id==='contactNotes'){
      const box=await editor.boundingBox(), card=await page.locator('.cpData').boundingBox();
      expect(box.x).toBeGreaterThan(card.x+80);
      expect(box.x+box.width).toBeLessThanOrEqual(card.x+card.width);
      await evidence(page,'06-edicion-individual-notas');
    }
    await page.locator('[data-inline-cancel]').click();
    await expect(editor).toHaveCount(0);
    await expect(native).toHaveValue(original);
    await expect(native).toHaveAttribute('readonly','');
  }
  await page.locator('[data-inline-field="contactNotes"]').click();
  await page.locator('.tpfInlineContactInput').fill('Borrador de prueba');
  await page.locator('[data-inline-field="contactPhone"]').click();
  await expect(page.locator('.tpfInlineContactMessage')).toContainText('Guarda o cancela');
  await page.locator('.tpfInlineContactInput').press('Escape');
  await expect(page.locator('.tpfInlineContactInput')).toHaveCount(0);
  await expect(page.locator('#contactModal')).toBeVisible();
  await evidence(page,'06-contacto-trabajo');
  await opportunities.locator('.tpfSummaryTrigger').click();
  await tasks.locator('.tpfSummaryTrigger').click();
  await evidence(page, '06-contacto');
  await page.locator('[data-tpf-summary-group="offers"] .tpfSummaryTrigger').click();
  const offerCards=await page.locator('#cpOffersSection .cpOfferCard').count();
  await expect(page.locator('[data-tpf-summary-group="offers"] .tpfSummaryChip').first()).toHaveText(offerCards+(offerCards===1?' oferta':' ofertas'));
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
  // Layout-only stress check: temporary DOM labels; never writes customer labels.
  const labelLayout=await page.locator('#contactLabelsList').evaluate(box=>{
    const added=[];
    for(let i=0;i<12;i++){const chip=document.createElement('span');chip.className='contactLabelChip';chip.innerHTML='<span>ETIQUETA DE PRUEBA '+i+'</span><button class="contactLabelChipRemove" type="button">×</button>';box.append(chip);added.push(chip);}
    const parent=box.getBoundingClientRect(),rects=added.map(x=>x.getBoundingClientRect());
    const result={wrap:rects.at(-1).top>rects[0].top,contained:rects.every(r=>r.left>=parent.left-1&&r.right<=parent.right+1&&r.bottom<=parent.bottom+1),overflow:getComputedStyle(box).overflow};
    added.forEach(x=>x.remove());return result;
  });
  expect(labelLayout.wrap).toBeTruthy();expect(labelLayout.contained).toBeTruthy();expect(labelLayout.overflow).toBe('visible');
});
