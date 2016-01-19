// BugTrack - nodejs version
// Ron Patterson, BPWC
// 1/18/2016

var express = require('express'),
    app = express(),
    MongoClient = require('mongodb').MongoClient,
    engines = require('consolidate'),
    bodyParser = require('body-parser'),
    assert = require('assert');

app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(bodyParser.urlencoded({ extended: true })); 

// Handler for internal server errors
function errorHandler(err, req, res, next) {
    console.error(err.message);
    console.error(err.stack);
    res.status(500).render('error_template', { error: err });
}

MongoClient.connect('mongodb://localhost:27017/bugtrack', function(err, db) {

    assert.equal(null, err);
    console.log("Successfully connected to MongoDB.");

	app.get('/', function(req, res, next) {
		res.render('bugForm');
	});

    app.get('/bugList', function(req, res) {
        db.collection('bt_bugs')
        .find({})
        //.sort({'title':1})
        .toArray(function(err, bugs) {
            res.render('bugList', { 'bugs': bugs } );
        });
    });

	app.post('/bug_add', function(req, res, next) {
		var title = req.body.title,
			year = req.body.year,
			imdb = req.body.imdb;
		if (typeof(title) == 'undefined' || title.trim() == '' || typeof(year) == 'undefined' || year.trim() == '' || typeof(imdb) == 'undefined' || imdb.trim() == '') {
			next('Please fill in all fields!');
		}
		else {
			// setup the movie document
			var doc = { 'title': title, 'year': year, 'imdb': imdb };
			var rec = db.collection('movies')
			.insert(doc, function(err, result) {
			    assert.equal(err, null);
				res.send("Inserted title: " + title + ", year: " + year + ", imdb: " + imdb);
			    console.log("Inserted a document into the movies collection.");
    		});
		}
	});
	
	app.use(errorHandler);

	var server = app.listen(3000, function() {
		var port = server.address().port;
		console.log('Express server listening on port %s.', port);
	});

});
