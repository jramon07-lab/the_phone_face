const {test,expect}=require('@playwright/test');

async function login(page){
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
  await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
  await page.locator('#signin').click();
  await expect(page.locator('#app')).toBeVisible({timeout:30000});
}

test('correo Microsoft 365: módulo independiente y plantillas visibles',async({page})=>{
  await login(page);
  const nav=page.locator('.nav[data-view="email"]');
  await expect(nav).toBeVisible({timeout:10000});
  await nav.click();
  await expect(page.locator('#view-email')).toBeVisible({timeout:5000});
  await expect(page.getByText('Microsoft 365',{exact:true}).first()).toBeVisible();
  await expect(page.locator('#tpfMailConnect')).toBeVisible();
  await page.locator('[data-mail-tab="templates"]').click();
  await expect(page.locator('#tpfTemplateNew')).toBeVisible();
  await expect(page.locator('#tpfTemplateSubject')).toBeVisible();
  await expect(page.locator('#tpfTemplateBody')).toBeVisible();
});

test('automatizaciones: etiqueta puede lanzar plantilla de correo',async({page})=>{
  await login(page);
  await page.locator('.nav[data-view="automations"]').click();
  await expect(page.locator('#tpfFlowBuilder')).toBeVisible({timeout:10000});
  await page.locator('#tpfFlowTrigger').selectOption('label_assigned');
  await expect(page.locator('#tpfFlowTriggerConfig select[data-trigger-key="label_id"]')).toBeVisible();
  await page.locator('[data-add="action"]').click();
  const action=page.locator('#tpfStepEditor select[data-key="action_type"]');
  await expect(action).toBeVisible();
  await expect(action.locator('option[value="send_email_template"]')).toHaveCount(1);
  await action.selectOption('send_email_template');
  await expect(page.locator('#tpfStepEditor [data-tpf-email-config]')).toBeVisible({timeout:3000});
  await expect(page.locator('#tpfStepEditor select[data-cfg="email_template_id"]')).toBeVisible();
  await expect(page.locator('#tpfStepEditor select[data-cfg="mailbox_id"]')).toBeVisible();
});