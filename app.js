'use strict';

/*
 * Express Dependencies
 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var port = 3000;
var io = require('socket.io')(http);
var azure = require('azure-storage');
var ps = require('process-sync');
var uuid = require('node-uuid');
var user_socket = {};
var franchise = { //this is the model of the society
    total_customers: 0,
    current_customers: 0,
    total_stations: 0,
    total_pumps: 0,
    total_gas_sold: 0,
    stations: {},
    last_updated: null
};

var bodyParser = require('body-parser')
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

//get history to build model/materialized view
var create_model = function(){

    var query = azure.TableQuery();
    tableService.queryEntities('events',query,null,function(err,res,resp){
        if (!err){
            //console.log(res.entries.length);
            //console.log(res.entries);
            for(var x = 0; x < res.entries.length;x++){
                process_event(res.entries[x]);
            }        
        }
    });
};
//var tableService = azure.createTableService('comp69052017a212','a2ioIjW7X0rJH9PbZjRJeKlqg4H+RKWV3NScdjH/xp0FSRf4GLgAE0PPCodbmy8RCraAv63FzFkwb91emuchjQ==');
var tableService = azure.createTableService('gsm','QKiizz0dnwyRvZcqsMMBRtm9vuuMDLvA2e3EE/aEZgigvd1/McMbicx59cqEaXZSN0lQ6PZg5TjOdkVBYbwTPw==');

//ensure table for loggin events is present
var create_env = function(){
    //log table
    tableService.createTableIfNotExists('events',function(error,result,response){
         if(!error){
            create_model();
             //console.log(result);
             //console.log(response);
         }else {
             //console.log(error);
         }
     });

}


create_env();
var entGen = azure.TableUtilities.entityGenerator;

app.use(express.static('assets/bower_components'))
app.use(express.static('public'));

//place created logs in table
var insert = function(event,callback){
    tableService.insertEntity('events',event,{echoContent: true},function(error,result,resp){
        //console.log(error);
        //console.log(result);
        //console.log(resp);
        if(!error){
            process_event(result,callback);
        }
    }); 
}

//listeners for socket connections
io.on('connection',function(socket){
    var event = create_event('users','add',null,null,socket.id,null);
    insert(event);   
    
    socket.on('disconnect',function(){
        var event = create_event('users','remove',null,null,socket.id,null);
        insert(event);   
    });

});

//transform request into suitable format for table storage
function create_event(entity ,action ,station_id ,pump_id ,user_id ,adjustment){
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth()+1; 

    var yyyy = today.getFullYear();
    if(dd<10){
        dd='0'+dd;
    } 
    if(mm<10){
        mm='0'+mm;
    } 
    
    var hh = today.getHours();
    if (hh < 10) hh = '0' + '' + hh;

    var mi = today.getMinutes();
    if (mi < 10) mi = '0' + '' + mi;

    var ss = today.getSeconds();
    if (ss < 10) ss = '0' + '' + ss;

    var ms = today.getMilliseconds();
    if (ms < 10) ms = '0' + '' + ms;
    else if (ms < 100) ms = '00' + '' + ms;

    var event = {
        "PartitionKey": entGen.String(yyyy+""+mm+""+dd),
        "RowKey": entGen.String(yyyy+""+mm+""+dd+hh+mi+ss+ms+'_'+uuid()),
        "entity": entity,
        "action": action,
        "station_id": station_id || 0,
        "pump_id": pump_id || 0,
        "user_id": user_id || 0,
        "adjustment": adjustment || 0

    };

    return event;
}

//test
app.get('/start',function(request,response){
    //console.log(request);
    
});

//add station
app.post('/station/add',function(req,res){
    res.send('ok');
    var event = create_event('stations','add',null,null,null,null);
    insert(event); 
});

//remove station
app.post('/station/remove',function(req,res){
    res.send('ok');
    //console.log('removing station '+req.body.station_id);
    var event = create_event('stations','remove',req.body.station_id,null,null,null);
    insert(event); 
});

//add a pump to a selected station
app.post('/pump/add',function(req,res){
    res.send('ok');
    var event = create_event('pumps','add',req.body.station_id,null,null,null);
    insert(event)
    ; 

});

//remove selected pump from operation
app.post('/pump/remove',function(req,res){
    var event = create_event('pumps','remove',req.body.station_id,req.body.pump_id,null,null);
    insert(event); 
    res.send(event['adjustment']['_']);
});

//add fuel to pump
app.post('/staff/refill',function(req,res){
    res.send('ok');
    var event = create_event('pump','refill',req.body.station_id,req.body.pump_id,null,100);
    insert(event); 
});

//consume fuel from pump
app.post('/customer/refill',function(req,res){
    
    var event = create_event('pump','purchase',req.body.station_id,req.body.pump_id,req.body.user_id,-15);
    insert(event,function(gas_received){
        franchise.total_gas_sold+=gas_received;
        res.json(gas_received);
        update_clients();
    }); 
});


//send updated model to connected clients
var update_clients = function(){
    io.emit('update',franchise);
}

//alter model to reflect ajustments from new logs
var process_refill = function(event){
    //console.log(event['adjustment']['_']);
    if( franchise.stations[event['station_id']['_']] != null &&
        franchise.stations[event['station_id']['_']]['pumps'] != null &&
        franchise.stations[event['station_id']['_']]['pumps'][event['pump_id']['_']]){
        franchise.stations[event['station_id']['_']]['pumps'][event['pump_id']['_']]['capacity'] += event['adjustment']['_'];
    }
}

var process_purchase = function(event,callback){
    if( franchise.stations[event['station_id']['_']] != null &&
        franchise.stations[event['station_id']['_']]['pumps'] != null &&
        franchise.stations[event['station_id']['_']]['pumps'][event['pump_id']['_']] &&
        franchise.stations[event['station_id']['_']]['pumps'][event['pump_id']['_']]['capacity'] >= -1*event['adjustment']['_']){
        franchise.stations[event['station_id']['_']]['pumps'][event['pump_id']['_']]['capacity'] += event['adjustment']['_'];
        callback(-1*event['adjustment']['_']);
    }else callback(0);
}

var process_pumps = function(event){
    if(event['action']['_'] == 'add'){
        event['capacity'] = 0;
        franchise.stations[event['station_id']['_']]['pumps'][event['RowKey']['_']] = event;
        franchise.stations[event['station_id']['_']]['pumps_count']++;
        franchise.total_pumps++;
    } 
    if(event['action']['_'] == 'remove'){
        delete franchise.stations[event['station_id']['_']]['pumps'][event['pump_id']['_']]; 
        franchise.stations[event['station_id']['_']]['pumps_count']--;
        franchise.total_pumps--;
    } 
}

var process_users = function(event){
    if(event['action']['_'] == 'add'){
        franchise['total_customers']++;
        franchise['current_customers']++;
    } 
    if(event['action']['_'] == 'remove'){
        franchise['current_customers']--;
    } 
}

var process_stations = function(event){
    if(event['action']['_'] == 'add'){
        event['pumps'] = {};
        event['pumps_count'] = 0;
        franchise.stations[event['RowKey']['_']] = event;
        franchise.total_stations++;
    }
    if(event['action']['_'] == 'remove'){
        delete franchise.stations[event['station_id']['_']];
        franchise.total_stations--;
    }
};

var process_event = function(event,callback){
    if(callback == undefined || callback == null){
        callback = function(){};
    }
    console.log(event['RowKey']['_']);
    //return;
    ps.lock();
    //console.log(msg);
    if(event['entity']['_'] == 'users'){
        process_users(event);
    }
    if(event['entity']['_'] == 'stations'){
        process_stations(event);
    }
    if(event['entity']['_'] == 'pumps'){
        process_pumps(event);
    }
    if(event['action']['_'] == 'refill'){
        process_refill(event);
    }
    if(event['action']['_'] == 'purchase'){
        process_purchase(event,callback);
    }
    if(franchise['last_updated'] < event['Timestamp']['_']){ franchise['last_updated'] = event['Timestamp']['_']; }
    update_clients();
    ps.unlock();
}

http.listen(3000, function(){
  console.log('listening on http://localhost:3000');
});

