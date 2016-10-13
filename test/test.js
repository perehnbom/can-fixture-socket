var QUnit = require('steal-qunit');
var fixtureSocket = require('can-fixture-socket');
var io = require('socket.io-client');

var mockServer;

QUnit.module('can-fixture-socket', {
	beforeEach: function(){
		mockServer = new fixtureSocket.Server(io);
	},
	afterEach: function(){
		mockServer.restore();
	}
});

// Test fixture connection
QUnit.test('basic connection', function(assert){
	//
	// Mock server:
	//
	mockServer.on('connection', function(){
		mockServer.emit('notifications', {test: 'OK'})
	});

	//
	// Test client:
	//
	var done = assert.async();
	assert.expect(2);
	var socket = io('localhost');
	socket.on('connect', function(){
		assert.ok(true, 'socket connected');
	});
	socket.on('notifications', function(data){
		assert.deepEqual(data, {test: 'OK'}, 'received notifications message');
		done();
	});
});

/**
 * Emulate a low level CRUD API.
 * Let the protocol be:
 * - on created / updated message send ACK with message data and emit created / updated event.
 * - on deleted send ACK with {success: true} and emit deleted event with the removed message id.
 */
QUnit.noop = function(){};
QUnit.test('CRUD service', function(assert){
	console.log('Started test 2');
	//
	// Mock server:
	//
	mockServer.on('messages create', function(data, fn){	// fn is the ACK callback
		data.id = 1;

		// send ack on the received event:
		fn && fn(data);

		mockServer.emit('messages created', data);
	});
	mockServer.on('messages update', function(data, fn){
		// send ack on the received event:
		fn && fn(data);

		mockServer.emit('messages updated', data);
	});
	mockServer.on('messages delete', function(data, fn){
		// send ack on the received event:
		fn && fn({success: true});

		mockServer.emit('messages deleted', {id: data.id});
	});

	//
	// Test client:
	//
	var done = assert.async();
	assert.expect(6);

	var socket = io('localhost');

	socket.on('connect', function(){
		socket.emit('messages create', {title: 'A new message'}, function(data){
			// on ACK verify data:
			assert.deepEqual(data, {id: 1, title: 'A new message'}, 'Emit a message to server');
		});
	});

	socket.on('messages created', function(data){
		assert.deepEqual(data, {title: 'A new message', id: 1}, 'Receive messages created');

		socket.emit('messages update', {title: 'An updated message', id: 1}, function(data){
			assert.deepEqual(data, {title: 'An updated message', id: 1}, 'Emit messages update');
		});

		socket.emit('messages delete', {id: 1}, function(data){
			assert.deepEqual(data, {success: true}, 'Emit messages delete');
		});
	});

	socket.on('messages updated', function(data) {
		assert.deepEqual(data, {title: 'An updated message', id: 1}, 'Receive messages updated');
	});

	socket.on('messages deleted', function(data) {
		assert.deepEqual(data, {id: 1}, 'Receive messages deleted');
		done();
	});
});

/**
 * Ex. 2. Make a fixture store with data.
 * Emulate CRUD operations.
 * Provide a way to define the CRUD methods, e.g. internally use can-connect dataUrl and map them to FeathersJS style.
 *
 * FeathersJS websocket protocol:
 *   event format: "<path>::<method>"
 *   e.g.
 *     - send("messages::find", query)
 *     - send("messages::get", id, query)
 *     - send("messages::create", data, query)
 *     - send("messages::update", id, data, query)
 */
QUnit.noop('Test fixture store', function(assert){
	return;
	console.log('Started test 3');
	//
	// Mock server
	//
	
	// Socket event handler can accept two arguments: data and a callback that is usually used as ACK.
	
	var messagesStore = fixture.store([
		{id: 1, title: 'One'},
		{id: 2, title: 'Two'}
	]);
	
	// #1: If we need to send some data back then we can use ACK callback for this:
	mockServer.on('messages find', function(query, fn){
		messagesStore.getListData(query).then(fn);
	});
	
	// #2: We can use a helper wrapper for event helper:
	mockServer.on('messages remove', fixtureSocket.toHandler(messagesStore.destroyData));
	
	// #3: We also can wrap fixture store to provide socket event ready methods:
	var socketMessagesStore = fixtureStore.wrapStore(messagesStore);
	mockServer.on({
		'messages get': socketMessagesStore.getData,
		'messages create': socketMessagesStore.createData,
		'messages update': socketMessagesStore.updateData
	});

	//
	// Test client:
	//
	var done = assert.async();
	var socket = io('localhost');

	socket.on('connect', function(){
		socket.emit('messages find', {}, function(data){
			QUnit.equal(data.length, 2);
		});
		socket.emit('messages get', {id: 1}, function(data){
			QUnit.deepEqual(data, {id: 1, title: 'One'});
		});
		socket.emit('messages update', {id: 1, title: 'OnePlus'}, function(data){
			QUnit.deepEqual(data, {id: 1, title: 'OnePlus'});
		});
		done();
	});
});
