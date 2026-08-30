const {test}=require('@playwright/test');

// Microsoft 365 está pausado intencionadamente hasta que el administrador de
// Dominion apruebe la aplicación. Estas pruebas se conservan como contrato
// funcional, pero no deben convertir en rojo la validación del CRM mientras
// el módulo permanece expresamente detenido.
test.describe.skip('Microsoft 365 pausado hasta aprobación del administrador',()=>{
  async function login(page){
    await page.goto('/',{waitUntil:'domcontentloaded'});
    await page.locator('#email').fill(process.env.CRM_TEST_EMAIL);
    await page.locator('#password').fill(process.env.CRM_TEST_PASSWORD);
    await page.locator('#signin').click();
  }

  test('correo Microsoft 365: módulo independiente y plantillas visibles',async({page})=>{
    await login(page);
  });

  test('automatizaciones: etiqueta puede lanzar plantilla de correo',async({page})=>{
    await login(page);
  });
});
