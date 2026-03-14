import frappe
frappe.init(site='rifah.localhost', sites_path='/home/frappe/frappe-bench/sites')
frappe.connect()
import json

for f in ['rifah_product_material', 'rifah_member', 'rifah_session']:
    with open('/tmp/' + f + '.json') as fp:
        doc = json.load(fp)
    if not frappe.db.exists('DocType', doc['name']):
        d = frappe.get_doc(doc)
        d.insert()
        frappe.db.commit()
        print('Imported: ' + doc['name'])
    else:
        print('Already exists: ' + doc['name'])

print('Done')