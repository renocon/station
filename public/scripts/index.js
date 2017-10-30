(function(window){

	var socket = io();
	//var user_socket = io('/users');
	var ractive;

	var franchise={};


	$(document).ready(function(){
		console.log('ready');
		console.log(socket);

		var add_station = function(){
			var input = {};
			$.post('/station/add',input,function(resp){
				//console.log(resp);
			},'json');
		}

		var remove_station = function(station_id){
			var input = {"station_id":station_id};
			$.post('/station/remove',input,function(resp){

			},'json');
		}

		var add_pump = function(station_id){
			var input = {
				station_id: station_id
			};
			$.post('/pump/add',input,function(resp){
				//console.log(resp);
			},'json');
		}

		var remove_pump =  function(pump_id,station_id){
			var input = {
				"station_id":station_id,
				"pump_id":pump_id
			};
			$.post('/pump/remove',input,function(resp){

			},'json');
		}

		var refill_customer = function(pump_id,station_id){
			$.post('/customer/refill',{
				station_id: station_id,
				pump_id: pump_id,
				user_id: socket.id
			},function(resp){
				console.log(resp)
				ractive.set('total_gas',ractive.get('total_gas')+resp)
			},'json')
		}

		var refill_staff = function(pump_id,station_id){
			$.post('/staff/refill',{
				station_id: station_id,
				pump_id: pump_id
			},function(resp){
				
			},'json')

		}

		ractive = new Ractive({
		  target: '#target',
		  template: '#template',
		  data: { franchise: franchise }
		});
		ractive.set('total_gas',0);
		ractive.on({
			selectStationCustomer:function(event,context,station_index){
					console.log(station_index);
					ractive.set("selectedStationCustomer",station_index);
					ractive.set("pumpsCustomer",franchise.stations[station_index]['pumps']);
					ractive.update();
				},
			selectStationStaff:function(event,context,station_index){
				console.log(station_index);
				ractive.set("selectedStationStaff",station_index);
				ractive.set("pumpsStaff",franchise.stations[station_index]['pumps']);
				ractive.update();
			},
			removeStation:function(event,context,station_index){
				console.log(station_index);
				remove_station(station_index);
				ractive.set("selectedStationStaff",null);
				ractive.set("pumpsStaff",{});
				ractive.update();
			},
			addPump:function(event,context){
				console.log(ractive.get('selectedStationStaff'));
				add_pump(ractive.get('selectedStationStaff'));
				ractive.update();
			},
			removePump:function(event,context,pump_index,station_index){
				remove_pump(pump_index,station_index);
				ractive.update();
			},
			selectPumpCustomer:function(event,context,pump_index){
				ractive.set('selectedPumpCustomer',pump_index);
				ractive.update();
			},
			selectPumpStaff:function(event,context,pump_index){
				ractive.set('selectedPumpStaff',pump_index);
				ractive.update();
			},
			refillCustomer:function(event,context,pump_id,station_id){
				refill_customer(pump_id,station_id);
				ractive.update();
			},
			refillStaff:function(event,context,pump_id,station_id){
				refill_staff(pump_id,station_id);
				ractive.update();
			}
	    });
		
		socket.on('update', function(msg){
			//if(msg['last_update'] < franchise['last_updated']) return;
			franchise = msg;
			ractive.set('franchise',franchise);
			ractive.set('pumpsCustomer',{});
			ractive.set('pumpsStaff',{});
			ractive.update();
			console.log('last updated:' + msg['last_updated']);
			console.log(msg);

		});


		$('#addStationButton').click(add_station);
	
	});


	

})(this);