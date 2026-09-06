const { test, expect } = require('@playwright/test');

function normalise(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function login(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login')).toBeVisible();
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
}

async function openWhatsApp(page) {
  await page.locator('.nav[data-view="whatsapplive"]').first().click();
  await expect(page.locator('#view-whatsapplive')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#waLiveChats .waChatRow').first()).toBeVisible({ timeout: 30000 });
}

async function selectedChatId(page) {
  return page.evaluate(() => {
    try { return String(waLiveState?.selected?.id || ''); } catch (_) { return ''; }
  });
}

async function selectChat(page, chatId) {
  await page.evaluate(async id => {
    if (typeof window.selectWhatsAppChat !== 'function') throw new Error('selectWhatsAppChat no está disponible');
    await window.selectWhatsAppChat(id);
  }, chatId);
  await expect.poll(() => selectedChatId(page), { timeout: 10000 }).toBe(chatId);
  await expect(page.locator('#waChatActive')).toBeVisible({ timeout: 10000 });
}

async function expectSameWhatsAppOrigin(page, chatId) {
  await expect(page.locator('#view-whatsapplive')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#waChatActive')).toBeVisible({ timeout: 10000 });
  await expect.poll(() => selectedChatId(page), { timeout: 10000 }).toBe(chatId);
  const screen = await page.evaluate(() => window.tpfCaptureCurrentScreen?.() || null);
  expect(screen, 'El router debe exponer la pantalla actual para restaurar el origen').toBeTruthy();
  expect(screen.mainView).toBe('whatsapplive');
  expect(screen.waChatId).toBe(chatId);
}

async function findChatContexts(page) {
  const rows = page.locator('#waLiveChats .waChatRow');
  const count = Math.min(await rows.count(), 40);
  let matched = null;
  let matchedWithTasks = null;
  let unmatched = null;

  for (let index = 0; index < count && (!matchedWithTasks || !unmatched); index += 1) {
    const row = rows.nth(index);
    const chatId = await row.locator('[data-wa-avatar-id]').getAttribute('data-wa-avatar-id');
    if (!chatId) continue;
    await row.click();
    await expect.poll(() => selectedChatId(page), { timeout: 10000 }).toBe(chatId);
    await page.waitForTimeout(450);
    const state = await page.evaluate(() => {
      let contact = null;
      try { contact = waLiveState?.contact || null; } catch (_) {}
      return {
        matched: Boolean(contact?.id),
        contactId: String(contact?.id || ''),
        taskCount: document.querySelectorAll('#waSideTasks .cpTaskWrap, #waSideTasks .waTaskCard').length,
        createVisible: [...document.querySelectorAll('#waSideCreateContact, #waCreateContactTop')]
          .some(node => !node.classList.contains('hidden') && getComputedStyle(node).display !== 'none')
      };
    });
    if (state.matched) {
      matched ||= { chatId, contactId: state.contactId };
      if (state.taskCount > 0) matchedWithTasks = { chatId, contactId: state.contactId };
    } else if (state.createVisible) {
      unmatched = { chatId };
    }
  }

  expect(matched, 'Se necesita al menos un chat vinculado para probar los retornos').toBeTruthy();
  expect(matchedWithTasks, 'Se necesita un chat vinculado con tareas para probar sus acciones').toBeTruthy();
  expect(unmatched, 'Se necesita un chat no vinculado para probar el alta de contacto').toBeTruthy();
  return { matched, matchedWithTasks, unmatched };
}

test('WhatsApp conserva los siete flujos del CRM sin escribir datos', async ({ page }) => {
  test.setTimeout(210000);
  // Only avatar image bytes are isolated; chat/search/navigation use the real service.
  await page.route('**/api/green?action=avatar',route=>route.fulfill({json:{ok:true,urlAvatar:'data:image/svg+xml;base64,PHN2Zy8+'}}));
  await login(page);
  await openWhatsApp(page);

  await test.step('1. Busca nombres y continúa conversaciones y avatares más allá de diez', async () => {
    const rows = page.locator('#waLiveChats .waChatRow');
    const initialNames = await rows.locator('.waChatRowTop b').allTextContents();
    const name = initialNames.find(value => /[a-záéíóúüñ]{3}/i.test(value));
    expect(name, 'Debe existir una conversación con nombre para probar la búsqueda').toBeTruthy();

    const query = normalise(name);
    await page.locator('#waLiveSearch').fill(query);
    await expect.poll(async () => rows.count(), { timeout: 10000 }).toBeGreaterThan(0);
    const filteredNames = await rows.locator('.waChatRowTop b').allTextContents();
    expect(filteredNames.every(value => normalise(value).includes(query)),
      'Una consulta alfabética no puede dejar pasar todos los teléfonos por includes("")').toBe(true);

    await page.locator('#waLiveSearch').fill('');
    await expect.poll(async () => rows.count(), { timeout: 10000 }).toBeGreaterThan(10);

    const paging = await page.evaluate(() => ({
      total: Array.isArray(window.waLiveState?.chats) ? window.waLiveState.chats.length : 0,
      rendered: document.querySelectorAll('#waLiveChats .waChatRow').length,
      hasMore: Boolean(document.querySelector('#waLiveChats .waLiveLoadMore'))
    }));
    if (paging.total > paging.rendered) {
      expect(paging.hasMore, 'Debe ofrecer carga progresiva si quedan conversaciones').toBe(true);
      await page.locator('#waLiveChats .waLiveLoadMore').click();
      await expect.poll(async () => rows.count(), { timeout: 10000 }).toBeGreaterThan(paging.rendered);
    }

    const hydrated = await page.evaluate(async () => {
      const box = document.getElementById('waLiveChats');
      if (!box || typeof window.hydrateWaAvatars !== 'function') return 0;
      const holder = document.createElement('div');
      const bounds=box.getBoundingClientRect();
      holder.style.cssText = `position:fixed;top:${bounds.top+4}px;left:${bounds.left+4}px;width:4px;height:4px;pointer-events:none`; 
      const ids = Array.from({ length: 16 }, (_, index) => `tpf-regression-avatar-${index}`);
      ids.forEach(id => {
        const avatar = document.createElement('span');
        avatar.dataset.waAvatarId = id;
        avatar.dataset.waInitials = 'PR';
        avatar.style.cssText = 'position:absolute;top:4px;left:4px;width:2px;height:2px';
        holder.appendChild(avatar);
      });
      box.appendChild(holder);

      const calls = new Set();
      const oldApi = window.waApi;
      const oldLoad = window.waLoadAvatar;
      const avatarUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=';
      window.waApi = async (action, payload, ...rest) => {
        if (action === 'avatar' && ids.includes(String(payload?.chatId || ''))) {
          calls.add(String(payload.chatId));
          return { urlAvatar: avatarUrl };
        }
        return oldApi(action, payload, ...rest);
      };
      window.waLoadAvatar = async id => {
        if (ids.includes(String(id))) {
          calls.add(String(id));
          return avatarUrl;
        }
        return oldLoad(id);
      };
      try {
        await window.hydrateWaAvatars(ids);
        const limit = Date.now() + 3500;
        while (calls.size <= 10 && Date.now() < limit) await new Promise(resolve => setTimeout(resolve, 80));
        return calls.size;
      } finally {
        window.waApi = oldApi;
        window.waLoadAvatar = oldLoad;
        holder.remove();
      }
    });
    expect(hydrated, 'La hidratación no debe detenerse en ocho o diez avatares').toBeGreaterThan(10);
  });

  const { matched, matchedWithTasks, unmatched } = await findChatContexts(page);

  await test.step('2. Programar WhatsApp permite elegir una plantilla', async () => {
    await selectChat(page, matched.chatId);
    await page.locator('#waScheduleBtn').click();
    await expect(page.locator('#tpfSched3')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#tpfS3template')).toHaveText(/Usar plantilla/i);
    await page.locator('#tpfS3template').click();
    await expect(page.locator('#tpfDirectPickerModal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#tpfDirectSearch')).toBeEditable();
    await expect(page.locator('#tpfDirectCats')).toBeVisible();
    await page.locator('#tpfDirectPickerModal [data-picker-close]').click();
    await expect(page.locator('#tpfDirectPickerModal')).toHaveCount(0);
    await page.locator('#tpfSched3 [data-close]').first().click();
    await expect(page.locator('#tpfSched3')).toHaveCount(0);
  });

  await test.step('3. Volver desde nueva oportunidad restaura el mismo chat', async () => {
    await selectChat(page, matched.chatId);
    await page.locator('#waSideNewOpp').click();
    await expect(page.locator('#oppDetailModal')).toBeVisible({ timeout: 10000 });
    await page.locator('#oppModalClose').click();
    await expectSameWhatsAppOrigin(page, matched.chatId);
  });

  await test.step('4. Crear tarea usa el compositor nuevo de Agenda y vuelve al chat', async () => {
    await page.locator('#waSideNewTask').click();
    await expect(page.locator('#agendaCreateCard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#agendaCreateCard')).toHaveClass(/\bopen\b/);
    await expect(page.locator('#agendaTypeChoices [data-type]').first()).toBeVisible();
    await expect(page.locator('#cpTaskPage')).toBeHidden();
    await page.locator('#agendaCloseCreate').click();
    await expectSameWhatsAppOrigin(page, matched.chatId);
  });

  await test.step('5. Volver desde la ficha completa restaura el mismo chat', async () => {
    await page.locator('#waSideOpenContact').click();
    await expect(page.locator('#contactModal')).toBeVisible({ timeout: 10000 });
    await page.locator('#contactClose').click();
    await expectSameWhatsAppOrigin(page, matched.chatId);
  });

  await test.step('6. Crear contacto muestra teléfono local y campo Apodo', async () => {
    await selectChat(page, unmatched.chatId);
    await page.locator('#waSideCreateContact:visible, #waCreateContactTop:visible').first().click();
    await expect(page.locator('#tpfWaCreateBack')).toBeVisible({ timeout: 10000 });
    const remoteDigits = unmatched.chatId.replace(/\D/g, '');
    const spanishLocal = remoteDigits.startsWith('0034')
      ? remoteDigits.slice(4)
      : remoteDigits.startsWith('34') ? remoteDigits.slice(2) : '';
    const expectedLocal = /^[6789]\d{8}$/.test(spanishLocal) ? spanishLocal : remoteDigits;
    await expect(page.locator('#tpfWaPhone')).toHaveValue(expectedLocal);
    await expect(page.locator('#tpfWaNickname')).toBeEditable();
    await page.locator('#tpfWaCreateClose').click();
    await expect(page.locator('#tpfWaCreateBack')).toBeHidden();
    await expectSameWhatsAppOrigin(page, unmatched.chatId);
  });

  await test.step('7. Ver tareas ofrece abrir, completar o reabrir y eliminar con confirmación', async () => {
    await selectChat(page, matchedWithTasks.chatId);
    await page.locator('#waSideViewTasks').click();
    await expect(page.locator('#tpfWaTasksPage')).toBeVisible({ timeout: 10000 });
    const row = page.locator('#tpfWaTasksList [data-task-id]').first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.locator('.tpfWaFocusedTaskEdit')).toHaveText(/Abrir\s*\/\s*editar/i);
    await expect(row.locator('.tpfWaFocusedTaskToggle')).toHaveText(/Completar|Reabrir/i);
    await expect(row.locator('.tpfWaFocusedTaskDelete')).toHaveText(/Eliminar/i);

    let dialogType = '';
    page.once('dialog', dialog => {
      dialogType = dialog.type();
      void dialog.dismiss();
    });
    await row.locator('.tpfWaFocusedTaskDelete').click();
    expect(dialogType).toBe('confirm');
    await expect(row).toBeVisible();

    await row.locator('.tpfWaFocusedTaskEdit').click();
    await expect(page.locator('#agendaCreateCard')).toHaveClass(/\bopen\b/);
    await page.locator('#agendaCloseCreate').click();
    await expect(page.locator('#tpfWaTasksPage')).toBeVisible({ timeout: 10000 });
    await page.locator('#tpfWaTasksBack').click();
    await expectSameWhatsAppOrigin(page, matchedWithTasks.chatId);
  });
});
