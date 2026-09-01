(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  // Ownership note:
  // Contact editing is owned by contact-profile.js + contacts-sales-core.js.
  // Opportunity editing is owned by the native sales/opportunity modules.
  // This former bridge intentionally installs no click interception, duplicate
  // editor, MutationObserver or DOM layer manipulation.
  M.register('contact-edit',{install(){}});
})();
