(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M)return;

  // Contact editing is owned by contact-profile.js + contacts-sales-core.js.
  // Keep this legacy module registered only for compatibility: it must not
  // create another editor, intercept clicks or alter opportunity layers.
  M.register('contact-edit',{install(){}});
})();
