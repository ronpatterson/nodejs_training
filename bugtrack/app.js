// BugTrack - nodejs server module
// Ron Patterson, BPWC
// 1/18/2016

'use strict';

// load required modules
var express = require('express'),
	app = express(),
	MongoClient = require('mongodb').MongoClient,
	ObjectId = require('mongodb').ObjectID,
	engines = require('consolidate'),
	bodyParser = require('body-parser'),
	fs = require('fs'),
	dateFormat = require('dateformat'),
	crypto = require('crypto'),
	mailer = require("nodemailer"),
	path = require("path"),
	multer = require('multer'),
	upload = multer(), // for parsing multipart/form-data
	assert = require('assert');

// globals
var lookups = [],
	adir = '/usr/local/data/',
	mongo_host = 'localhost',
	mongo_port = '27017',
	smtp_host = 'smtp.postoffice.net',
	smtp_user = 'ron.patterson%40usa.net',
	smtp_pw = 'xxxx';

// setup express.js
app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true })); 
console.log('Current directory: ',process.cwd());

// Handler for internal server errors
function errorHandler(err, req, res, next) {
	console.error(err.message);
	console.error(err.stack);
	res.status(500).render('error_template', { error: err });
}

function getBTlookup ( type, cd ) {
	var arr = lookups[type];
	for (var x=0; x<arr.length; ++x) {
		if (arr[x]['cd'] === cd) return arr[x]['descr'];
	}
}

// app initialization
function app_init ( db ) {
	// load lookups with the bt_lookups and bt_users collections
	var cursor = db.collection('bt_lookups').find( { } );
	var results = {};
	cursor.forEach(function(doc) {
		//assert.equal(null, doc);
		var arr = [];
		var id = doc._id;
		doc.items.forEach(function(element, index, array) {
			if (element.active == "y")
				arr.push({"cd":element.cd,"descr":element.descr});
		});
		results[id] = arr;
	}, function(err) {
		assert.equal(null, err);
		results.roles = "admin";
		results.users = {};
		// get users for lookups
		var cursor = db.collection('bt_users').find( { } );
		cursor.forEach(function(doc) {
			//console.log(doc);
			doc.name = doc.lname + ', ' + doc.fname;
			results.users[doc.uid] = doc;
		}, function(err) {
			assert.equal(null, err);
			//console.log(results);
			lookups = results;
			//console.log('Lookups loaded');
		});
	});
}

MongoClient.connect('mongodb://'+mongo_host+':'+mongo_port+'/bugtrack', function(err, db) {

	assert.equal(null, err);
	console.log("Successfully connected to MongoDB.");
	app_init(db);
	//debugger;
	setInterval(function() {app_init(db)},60000); // refresh lookups

	app.get('/', function(req, res, next) {
		res.render('bugtrack');
	});

	app.get('/bt_init', function(req, res) {
		//console.log(lookups);
		res.json(lookups);
		res.end();
	});

	app.get('/bugList', function(req, res) {
		db.collection('bt_bugs')
		.find({})
		.sort({'bug_id':1})
		.toArray(function(err, bugs) {
			res.render('bugList', { 'bugs': bugs });
		});
	});

	app.get('/bug_list', function(req, res) {
		var results = [];
		var crit = {};
		var crit0 = req.query.crit;
		if (crit0 && crit0.length > 1)
			crit = {'$and':crit0};
		var cursor = db.collection('bt_bugs').find(crit);
		cursor.sort({'bug_id':1})
		cursor.forEach(function(doc) {
			//console.log(doc);
			//doc.entry_dtm = date("m/d/Y g:i a",doc.entry_dtm.sec);
			doc.entry_dtm = dateFormat(doc.entry_dtm,'mm/dd/yyyy h:MM tt');
			doc.status = getBTlookup("bt_status",doc.status);
			results.push(doc);
		}, function(err) {
			assert.equal(null, err);
			results = {'data':results};
			//console.log(results);
			res.json(results);
			res.end();
		});
	});

	app.get('/bug_get', function(req, res) {
		var id = req.query.id;
		db.collection('bt_bugs')
		.findOne(
			{ '_id': new ObjectId(id) },
			function(err, bug) {
				assert.equal(null, err);
				bug.status_descr = getBTlookup("bt_status",bug.status);
				bug.priority_descr = getBTlookup("bt_priority",bug.priority);
				//var bt = getBTlookup("bt_type",bug.bug_type);
				bug.edtm = dateFormat(bug.entry_dtm,'mm/dd/yyyy h:MM tt');
				bug.udtm = typeof(bug.update_dtm) == 'undefined' ? '' : dateFormat(bug.update_dtm,'mm/dd/yyyy h:MM tt');
				bug.cdtm = typeof(bug.closed_dtm) == 'undefined' ? '' : dateFormat(bug.closed_dtm,'mm/dd/yyyy h:MM tt');
				if (typeof(bug.user_nm) == 'string') {
					var obj = lookups.users[bug.user_nm];
					bug.ename = obj.lname + ', ' + obj.fname;
				} else { bug.ename="";}
				if (typeof(bug.assigned_to) == 'string') {
					var obj = lookups.users[bug.assigned_to];
					bug.aname = obj.lname + ', ' + obj.fname;
				} else { bug.aname="";}
				if (typeof(bug.worklog) != 'undefined') {
					for (var i=0; i<bug.worklog.length; ++i) {
						bug.worklog[i].edtm = typeof(bug.worklog[i].entry_dtm) == 'undefined' ? '' : dateFormat(bug.worklog[i].entry_dtm,'mm/dd/yyyy h:MM tt');
					}
				}
				if (typeof(bug.attachments) != 'undefined') {
					for (var i=0; i<bug.attachments.length; ++i) {
						bug.attachments[i].edtm = typeof(bug.attachments[i].entry_dtm) == 'undefined' ? '' : dateFormat(bug.attachments[i].entry_dtm,'mm/dd/yyyy h:MM tt');
					}
				}
				//console.log(bug);
				res.json(bug);
				res.end();
			}
		);
	});
	
	app.post('/bug_add_update', function(req, res, next) {
		//console.log(req.body); res.end('TEST'); return;
		if (req.body.id == '') { // add
			db.collection('counters').findAndModify (
				{ "_id": 'bug_id' },
				[ ],
				{ '$inc': { 'seq': 1 } },
				{
					"new": true,
					"upsert": true
				},
				function (err, updoc) {
					assert.equal(null, err);
					console.log(updoc);
					var id = updoc.value.seq;
					var bug_id = req.body.bt_group + id;
					var iid = new ObjectId();
					var doc = {
  "_id": iid
, "bug_id": bug_id
, "descr": req.body.descr
, "product": req.body.product
, "user_nm": req.body.user_id
, "bug_type": req.body.bug_type.substr(0,1)
, "status": req.body.status
, "priority": req.body.priority
, "comments": req.body.comments
, "solution": req.body.solution
, "entry_dtm": new Date()
};
					//console.log(doc); res.end('TEST'); return;
					db.collection('bt_bugs')
					.insert(
						doc,
						function(err, result) {
							assert.equal(err, null);
							console.log("Inserted a document into the bt_bugs collection.");
							//console.log(result);
							res.send('SUCCESS '+iid+','+bug_id);
							res.end();
						}
					);
				}
			)
		}
		else { // update
			var bid = req.body.bug_id.replace(/.*(\d+)$/,'$1');
			var bug_id = req.body.bt_group + bid;
			var doc = {
  "bug_id": bug_id
, "descr": req.body.descr
, "product": req.body.product
, "user_nm": req.body.user_id
, "bug_type": req.body.bug_type.substr(0,1)
, "status": req.body.status
, "priority": req.body.priority
, "comments": req.body.comments
, "solution": req.body.solution
, "update_dtm": new Date()
};
			//console.log(doc); res.end('TEST'); return;
			var id = req.body.id;
			db.collection('bt_bugs')
			.updateOne(
				{ '_id': new ObjectId(id) },
				{ '$set': doc },
				function(err, result) {
					assert.equal(err, null);
					//console.log("Updated a document in the bt_bugs collection.");
					//console.log(result);
					res.send('SUCCESS');
					res.end();
				}
			);
		}
	});

	app.post('/bug_delete', function(req, res) {
		console.log(req.body); res.end('SUCCESS'); return;
		var id = req.body.id;
		db.collection('bt_bugs')
		.removeOne(
			{ '_id': new ObjectId(id) },
			function(err, result) {
				assert.equal(err, null);
				console.log("Removed document from the bt_bugs collection.");
				//console.log(result);
				res.send('SUCCESS');
				res.end();
			}
		);
	});

	app.post('/worklog_add', function(req, res, next) {
		//console.log(req.body); res.end('TEST'); return;
		var id = req.body.id;
		var doc = {
  "user_nm": req.body.usernm
, "comments": req.body.wl_comments
, "wl_public": req.body.wl_public
, "entry_dtm": new Date()
};
		//console.log(bug,doc); res.end('SUCCESS'); return;
		var rec = db.collection('bt_bugs')
		.updateOne(
			{ '_id': new ObjectId(id) },
			{ '$push': { 'worklog': doc } },
			function(err, result) {
				assert.equal(err, null);
				console.log("Inserted a worklog into the bt_bugs collection.");
				//console.log(result);
				res.send('SUCCESS');
				res.end();
			}
		)
	});

	app.post('/worklog_updateX', function(req, res, next) {
		//console.log(req.body); res.end('TEST'); return;
		var id = req.body.id;
		var idx = req.body.idx;
		db.collection('bt_bugs')
		.findOne(
			{ '_id': new ObjectId(id) },
			function(err, bug) {
				assert.equal(null, err);
				var doc = {
  "user_nm": req.body.usernm
, "comments": req.body.wl_comments
, "wl_public": req.body.wl_public
, "entry_dtm": new Date()
};
				bug.worklog[idx] = doc;
				var rec = db.collection('bt_bugs')
				.update(
					{ '_id': new ObjectId(id) },
					{ '$set': { 'worklog': bug.worklog } },
					function(err, result) {
						assert.equal(err, null);
						console.log("Updated a worklog in the bt_bugs collection.");
						//console.log(result);
						res.send('SUCCESS');
						res.end();
					}
				)
			}
		)
	});

	app.post('/assign_user', function(req, res, next) {
		//console.log(req.body); res.end('TEST'); return;
		var id = req.body.id;
		var doc = {
  "assigned_to": req.body.uid
, "update_dtm": new Date()
};
		//console.log(bug,doc); res.end('SUCCESS'); return;
		var rec = db.collection('bt_bugs')
		.update(
			{ '_id': new ObjectId(id) },
			{ '$set': doc },
			function(err, result) {
				assert.equal(err, null);
				console.log("Updated assignment in the bt_bugs collection.");
				//console.log(result);
				res.send('SUCCESS');
				res.end();
			}
		)
	});

	app.post('/bug_email', function(req, res, next) {
		//console.log(req.body); res.end('TEST'); return;
		var id = req.body.id;
		db.collection('bt_bugs')
		.findOne(
			{ '_id': new ObjectId(id) },
			function(err, bug) {
				assert.equal(null, err);
				var status = getBTlookup("bt_status",bug.status);
				var priority = getBTlookup("bt_priority",bug.priority);
				var bt = getBTlookup("bt_type",bug.bug_type);
				var edtm = dateFormat(bug.entry_dtm,'mm/dd/yyyy h:MM tt');
				var udtm = typeof(bug.update_dtm) == 'undefined' ? '' : dateFormat(bug.update_dtm,'mm/dd/yyyy h:MM tt');
				var cdtm = typeof(bug.closed_dtm) == 'undefined' ? '' : dateFormat(bug.closed_dtm,'mm/dd/yyyy h:MM tt');
				if (typeof(bug.user_nm) == 'string') {
					var obj = lookups.users[bug.user_nm];
					var ename = obj.lname + ', ' + obj.fname;
					var email = obj.email;
				} else { var ename=""; var email="";}
				if (typeof(bug.assigned_to) == 'string') {
					var obj = lookups.users[bug.assigned_to];
					var aname = obj.lname + ', ' + obj.fname;
					var aemail = obj.email;
				} else { var aname=""; var aemail="";}
				var msg = req.body.msg2 +"\n\
\n\
Details of Bug ID " + req.body.bug_id + "\n\
\n\
Description: " + bug.descr + "\n\
Product or Application: " + bug.product + "\n\
Bug Type: " + bt + "\n\
Status: " + status + "\n\
Priority: " + priority + "\n\
Comments: " + bug.comments + "\n\
Solution: " + bug.solution + "\n\
Assigned To: " + aname + "\n\
Entry By: " + ename + "\n\
Entry Date/Time: " + edtm + "\n\
Update Date/Time: " + udtm + "\n\
Closed Date/Time: " + cdtm + "\n\
\n\
";
				var rows = typeof(bug.worklog) == 'object' ? bug.worklog : [];
				msg += rows.length + " Worklog entries found\n\n";
				if (rows.length > 0) {
					for (var x=0; x<rows.length; ++x) {
						var row = rows[x];
						if (row.user_nm != "") {
							var obj = lookups.users[row.user_nm];
							var ename = obj.lname + ', ' + obj.fname;
						} else var ename="";
						var edtm = typeof(row.entry_dtm) == 'undefined' ? '' : dateFormat(row.entry_dtm,'mm/dd/yyyy h:MM tt');
						msg += "Date/Time: " + edtm + ", By: " + ename + "\n\
	Comments: " + row.comments + "\n";
					}
				}
				console.log(msg);
				// Use Smtp Protocol to send Email
				var transporter = mailer.createTransport('smtps://'+smtp_user+':'+smtp_pw+'@'+smtp_host);
				var mail = {
					from: "BugTrack <ronlpatterson@gmail.com>",
					to: req.body.sendto,
					subject: req.body.subject,
					text: msg
					//html: "<b>Node.js New world for me</b>"
				}
				if (req.body.cc != '') mail.cc = req.body.cc;
				transporter.sendMail(mail, function(error, response) {
					if (error) {
						console.log(error);
					}
					else {
						console.log("Message sent: "); console.log(response);
					}
					transporter.close();
				});
				res.send('SUCCESS');
				res.end();
			}
		)
	});

	app.post('/attachment_add', upload.single('upfile'), function(req, res, next) {
		//console.log(req.body); console.log(req.file); res.end('SUCCESS'); return;
/*
{ fieldname: 'upfile',
  originalname: 'hsm_dates.txt',
  encoding: '7bit',
  mimetype: 'text/plain',
  buffer: <Buffer 30 35 2f 32 30 2f 32 30 31 32 0a 30 35 2f 32 37 2f 32 30 31 32 0a 30 36 2f 30 33 2f 32 30 31 32 0a 30 36 2f 31 37 2f 32 30 31 32 0a 30 37 2f 30 38 2f 32 ...>,
  size: 220 }
*/
		var id = req.body.id;
		var raw_file = req.file.buffer;
		var hash = crypto.createHash('md5').update(raw_file).digest("hex");
		var doc = {
  "file_name": req.file.originalname
, "file_size": req.file.size
, "file_hash": hash
, "entry_dtm": new Date()
};
		var rec = db.collection('bt_bugs')
		.update(
			{ '_id': new ObjectId(id) },
			{ '$push': { 'attachments': doc } },
			function(err, result) {
				assert.equal(err, null);
				console.log("Inserted a attachment into the bt_bugs collection.");
				console.log(result);
				var pdir = hash.substr(0,3);
				fs.access(adir + pdir, fs.R_OK | fs.W_OK, function (err) {
					if (err) fs.mkdirSync(adir + pdir);
					fs.open(adir + pdir + "/" + hash,"w", function (err, fd) {
						assert.equal(err, null);
						fs.write(fd,raw_file);
					});
				});
				res.send('SUCCESS');
				res.end();
			}
		)
	});

	app.post('/attachment_delete', function(req, res) {
		//console.log(req.body); res.end('SUCCESS'); return;
		var id = req.body.id;
		var hash = req.body.hash;
		// remove from bt_bugs.attachments
		db.collection('bt_bugs')
		.update(
			{ '_id': new ObjectId(id) },
			{ '$pull': { 'attachments.file_hash': hash } },
			function(err, result) {
				assert.equal(err, null);
				console.log("Removed attachment from the bt_bugs collection.");
				//console.log(result);
				// delete file from fs
				var pdir = hash.substr(0,3);
				fs.unlink(adir + pdir + hash);
				res.send('SUCCESS');
				res.end();
			}
		)
	});

	app.get('/admin_lu_list', function(req, res) {
		var type = req.query.type;
		db.collection('bt_lookups')
		.findOne(
			{ '_id': type },
			{ 'fields': {'items': 1} },
			function(err, lu) {
				assert.equal(null, err);
				results = { 'data': lu.items };
				//console.log(results);
				res.json(results);
				res.end();
			}
		);
	});

	app.get('/admin_lu_get', function(req, res) {
		var type = req.query.type;
		db.collection('bt_lookups')
		.findOne(
			{ '_id': type },
			{ 'fields': {'items': 1} },
			function(err, lu) {
				assert.equal(null, err);
				res.json(lu.items);
				res.end();
			}
		);
	});

	app.post('/lu_add_update', function(req, res, next) {
		// check action
		//console.log(req.body); res.end('TEST'); return;
		var type = req.body.lu_type;
		var doc = {
  "cd": req.body.cd
, "descr": req.body.descr
, "active": req.body.active
};
		db.collection('bt_lookups')
		.findOne(
			{ '_id': type },
			function(err, lu) {
				if (req.body.lu_action == 'add') { // add
					// find array entry
					var i = 0;
					while (i < lu.items.length && lu.items[i].cd != req.body.cd) ++i;
					if (i < lu.items.length) {
						res.send('ERROR, Code already exist!');
						res.end();
						return;
					}
					lu.items.push(doc);
					var rec = db.collection('bt_lookups')
					.update(
						{ '_id': type },
						{ '$set': { 'items': lu.items } },
						function(err, result) {
							assert.equal(err, null);
							console.log("Inserted a lookup into the bt_lookups collection.");
							console.log(result);
							res.send('SUCCESS');
							res.end();
						}
					);
				}
				else { // change
					// find array entry
					var i = 0;
					while (i < lu.items.length && lu.items[i].cd != req.body.cd) ++i;
					// update array
					if (i < lu.items.length) {
						lu.items[i] = doc;
						//console.log(lu,id); //res.end('TEST'); return;
						var rec = db.collection('bt_lookups')
						.update(
							{ '_id': type },
							{ '$set': { 'items': lu.items } },
							function(err, result) {
								assert.equal(err, null);
								console.log("Updated a lookup in the bt_lookups collection.");
								//console.log(result);
								res.send('SUCCESS');
								res.end();
							}
						);
					}
				}
			}
		)
	});

	app.get('/admin_users', function(req, res) {
		//console.log('admin_users called ');
		//console.log(req);
		var crit = {};
		var temp = [];
		// check for possible criteria
		var lname = req.query.lname;
		var fname = req.query.fname;
		if (lname && lname.trim() != '')
			temp.push({'lname':{'$regex':'^'+lname,'$options':'i'}});
		if (fname && fname.trim() != '')
			temp.push({'fname':{'$regex':'^'+fname,'$options':'i'}});
		if (temp.length == 2)
			crit = {'$and':temp};
		else if (temp.length == 1)
			crit = temp[0];
		var results = [];
		var cursor = db.collection('bt_users').find(crit);
		cursor.sort( [ [ 'lname', 1 ], [ 'fname', 1 ] ] );
		//console.log(cursor);
		cursor.forEach(function(doc) {
			//console.log(doc);
			doc.name = doc.lname + ', ' + doc.fname;
			results.push(doc);
		}, function(err) {
			assert.equal(null, err);
			results = { 'data': results };
			//console.log(results);
			res.json(results);
			//res.send('<p>here</p>');
			res.end();
		});
	});

	app.get('/user_get', function(req, res) {
		var uid = req.query.uid;
		db.collection('bt_users')
		.findOne(
			{ 'uid': uid }, 
			function(err, user) {
				assert.equal(null, err);
				//console.log(user);
				user.name = user.lname + ', ' + user.fname;
				res.json(user);
				res.end();
			}
		);
	});

	app.post('/user_add_update', function(req, res, next) {
		// uid, lname, fname, email, active, roles, pw, bt_group
		var pw5 = crypto.createHash('md5').update(req.body.pw).digest("hex");
		// check action
		//console.log(req.body); res.end('TEST'); return;
		if (req.body.id == '') { // add
			var doc = {
  "uid": req.body.uid2
, "lname": req.body.lname
, "fname": req.body.fname
, "email": req.body.email
, "active": req.body.active
, "roles": [req.body.roles]
, "pw": pw5
, "bt_group": req.body.bt_group
};
			var rec = db.collection('bt_users')
			.insert(
				doc,
				function(err, result) {
					assert.equal(err, null);
					console.log("Inserted a document into the bt_users collection.");
					console.log(result);
					res.send('SUCCESS');
					res.end();
				}
			);
		}
		else { // update
			if (req.body.pw == req.body.pw2) pw5 = req.body.pw;
			else pw5 = crypto.createHash('md5').update(req.body.pw).digest("hex");;
			var doc = {
  "lname": req.body.lname
, "fname": req.body.fname
, "email": req.body.email
, "active": req.body.active
, "roles": [req.body.roles]
, "pw": pw5
, "bt_group": req.body.bt_group
};
			var id = req.body.id;
			var rec = db.collection('bt_users')
			.update(
				{ '_id': new ObjectId(id) },
				{ '$set': doc },
				function(err, result) {
					assert.equal(err, null);
					console.log("Updated a document in the bt_users collection.");
					console.log(result);
					res.send('SUCCESS');
					res.end();
				}
			);
		}
	});

	app.use(errorHandler);

	var server = app.listen(3000, function() {
		var port = server.address().port;
		console.log('Express server listening on port %s.', port);
	});

}); // MongoClient.connect
