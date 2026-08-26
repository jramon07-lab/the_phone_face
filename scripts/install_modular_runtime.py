from pathlib import Path

p = Path('index.html')
text = p.read_text(encoding='utf-8')
marker = '<!-- TPF-MODULAR-RUNTIME-v1 -->'
if marker in text:
    print('Modular runtime already installed')
    raise SystemExit(0)

block = '''\n<!-- TPF-MODULAR-RUNTIME-v1 -->\n<script src="/js/modules/runtime.js"></script>\n<script src="/js/modules/whatsapp.js"></script>\n<script src="/js/modules/agenda.js"></script>\n<script src="/js/modules/contacts-sales.js"></script>\n<script src="/js/modules/automations-settings.js"></script>\n<script src="/js/modules/system-status.js"></script>\n'''

needle = '</body>'
if needle not in text:
    raise SystemExit('No </body> found in index.html')
text = text.replace(needle, block + '\n' + needle, 1)
p.write_text(text, encoding='utf-8')
print('Installed modular runtime script tags')
