(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M) return;
  M.register('automations-settings',{
    install(){
      M.wrapGlobals('automations-settings',[
        'loadAutomations','renderAutomations','loadGoogleSettings','loadNotifySettings',
        'saveNotifySettings','saveGoogleSettings','loadUsersAdmin','renderSelectedUserPerms',
        'saveSelectedUserPerms','loadSettings','renderSettingsSearchColumns'
      ]);
    }
  });
})();
