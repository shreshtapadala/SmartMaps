
    <script>
        var map, searchDatasource, routeDatasource, popup, searchURL, routeURL, timeInSeconds,voiceAssistantEnabled=false, weatherForPointActive=false, searchActive=false, calculateRouteActive=false, showAllRoutesActive=false, bestWayActive=false, zoomIn=false, zoomOut=false, displayTraffic=false, decreasePitch=false, increasePitch=false, rotateRight=false, rotateLeft=false, text = '', array = [];

        var currentConditionsUrl = 'https://atlas.microsoft.com/weather/currentConditions/json?api-version=1.1&query={query}';
        
        const speechAPIKey = "ed3be90b3d4a45fbbc18f16c1fa0884b";
        const region = "southeastasia";

        var weatherTemplate = {
            title: 'Weather : ',

            content:
                '<img class="weather-icon" src="/images/icons/weather-black/{iconCode}.png"/>' +
                '<div class="weather-content">' +
                '<div class="weather-temp">{temperature/value}&#176;</div>' +
                'RealFeel : {realFeelTemperature/value}&#176;C' +
                '<div class="weather-phrase">{phrase}</div>' +
                'Humidity: {relativeHumidity}&#37</div>',

            numberFormat: {
                maximumFractionDigits: 2
            },

            sandboxContent: false
        }

        // Function to initialize the map and set up various components and interactions.
        function getMap() {
            map = new atlas.Map('myMap', {
                view: 'Auto',
                
                language: 'en-US',

                authOptions: {
                    authType: 'subscriptionKey',
                    subscriptionKey: 'AxL2HEskH7bPqG7UKHFpRRl8UzoBNwFbjkf0rj7V5Jpf3GTUsnJwJQQJ99AEACYeBjFo62xVAAAgAZMPfuMp'
                }
            });

            var pipeline = atlas.service.MapsURL.newPipeline(new atlas.service.MapControlCredential(map));

            routeURL = new atlas.service.RouteURL(pipeline);
            searchURL = new atlas.service.SearchURL(pipeline);

            //Adding style control to the map.
            map.controls.add(new atlas.control.StyleControl({
                mapStyles: ['road', 'satellite', 'satellite_road_labels', 'night', 'road_shaded_relief', 'grayscale_light', 'terra']
            }), {
                position: 'top-right'
            });
            
            //Wait until the map resources are ready.
            map.events.add('ready', function () {
                popup = new atlas.Popup();

                searchDatasource = new atlas.source.DataSource();
                routeDatasource = new atlas.source.DataSource();

                map.sources.add([searchDatasource, routeDatasource]);


                //Line layers for different routes and traffic sections.
                map.layers.add([
                    new atlas.layer.LineLayer(routeDatasource, 'carRouteBaseLine', {
                        strokeColor: '#1E90FF',
                        strokeWidth: 7,
                        lineJoin: 'round',
                        lineCap: 'round',
                        filter: ['==', ['get', 'routeType'], 'car']
                    }),
                    new atlas.layer.LineLayer(routeDatasource, 'bikeRouteBaseLine', {
                        strokeColor: 'purple',
                        strokeWidth: 3,
                        lineJoin: 'round',
                        lineCap: 'round',
                        filter: ['==', ['get', 'routeType'], 'bike']
                    }),
                    new atlas.layer.LineLayer(routeDatasource, 'cyclingRouteBaseLine', {
                        strokeColor: '#FFD700',
                        strokeWidth: 5,
                        lineJoin: 'round',
                        lineCap: 'round',
                        filter: ['==', ['get', 'routeType'], 'cycling']
                    }),
                    new atlas.layer.LineLayer(routeDatasource, 'walkingRouteBaseLine', {
                        strokeColor: '#8B4513',
                        strokeWidth: 3,
                        strokeDashArray: [1, 2],
                        lineJoin: 'round',
                        lineCap: 'round',
                        filter: ['==', ['get', 'routeType'], 'walking']
                    }),
                    
                    // Start and end points.
                    new atlas.layer.SymbolLayer(routeDatasource, null, {
                        iconOptions: {
                            image: ['get', 'iconImage'],
                            allowOverlap: true,
                            ignorePlacement: true
                        },
                        textOptions: {
                            textField: ['get', 'title'],
                            offset: [0, 1.2]
                        },
                        filter: ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']]
                    }),
                ]);

                //Traffic control to let the user easily turn the traffic on an off.
                map.controls.add(new atlas.control.TrafficControl(), {
                    position: 'top-right'
                });
                map.controls.add(new atlas.control.TrafficLegendControl(), { 
                    position: 'bottom-left'
                });


                var resultsLayer = new atlas.layer.SymbolLayer(searchDatasource);
                map.layers.add(resultsLayer);

                // Add a click event to the results symbol layer.
                map.events.add('click', resultsLayer, symbolClicked);

                //Create a popup but leaving it closed so we can update it and display it later.
                popup = new atlas.Popup({
                    position: [0, 0],
                    pixelOffset: [0, -18]
                });

                popup = new atlas.Popup();

                map.events.add('contextmenu', getWeatherForPoint);
                
                
                // Functions to add images and symbols for a route.

                map.imageSprite.add('carIcon', 'images/car.png').then(() => {
                    const symbolLayer = new atlas.layer.SymbolLayer(routeDatasource, null, {
                        lineSpacing: 1,
                        placement: 'line',
                        iconOptions: {
                            image: 'carIcon',
                            allowOverlap: true,
                            anchor: 'center',
                            size: 0.1,
                            rotation: -90
                        },
                        filter: ['==', ['get', 'routeType'], 'car']
                    });

                    map.layers.add(symbolLayer);
                });

                map.imageSprite.add('bikeIcon', 'images/bike.png').then(() => {
                    const symbolLayer = new atlas.layer.SymbolLayer(routeDatasource, null, {
                        lineSpacing: 470,
                        placement: 'line',
                        iconOptions: {
                            image: 'bikeIcon',
                            allowOverlap: true,
                            anchor: 'center',
                            offset: [0, 10],
                            size: 0.4,
                            rotation: 0
                        },
                        filter: ['==', ['get', 'routeType'], 'bike']
                    });

                    map.layers.add(symbolLayer);
                });

                map.imageSprite.add('bicycleIcon', 'images/bicycle.png').then(() => {
                    const symbolLayer = new atlas.layer.SymbolLayer(routeDatasource, null, {
                        lineSpacing: 250,
                        placement: 'line',
                        iconOptions: {
                            image: 'bicycleIcon',
                            allowOverlap: true,
                            anchor: 'center',
                            size: 0.5,
                            rotation: -30 
                        },
                        filter: ['==', ['get', 'routeType'], 'cycling']
                    });

                    map.layers.add(symbolLayer);
                });

                map.imageSprite.add('pedestrianIcon', 'images/pedestrian.png').then(() => {
                    const symbolLayer = new atlas.layer.SymbolLayer(routeDatasource, null, {
                        lineSpacing: 170,
                        placement: 'line',
                        iconOptions: {
                            image: 'pedestrianIcon',
                            allowOverlap: true,
                            anchor: 'center',
                            size: 0.3,
                            rotation: 0 
                        },
                        filter: ['==', ['get', 'routeType'], 'walking']
                    });

                    map.layers.add(symbolLayer);
                });        
            });
        }
      
        // Function to fetch and display weather information for a specific point on the map.
        function getWeatherForPoint(e) {
            popup.close();
            document.getElementById('bestWayContent').innerText = '';
            document.getElementById('bestWay').style.display = 'none';

            setFalse();
            weatherForPointActive=true;

            //Requesting the current conditions weather data based on position clicked.
            var requestUrl = currentConditionsUrl.replace('{query}', e.position[1] + ',' + e.position[0]);

            processRequest(requestUrl).then(response => {
                var content;
    
                if (response && response.results && response.results[0]) {
                    //Using the weatherTemplate settings to create templated content for the popup.
                    content = atlas.PopupTemplate.applyTemplate(response.results[0], weatherTemplate);
                } else {
                    content = '<div style="padding:10px;">Weather data not available for this location.</div>';
                }

                array = [response.results[0].temperature.value, response.results[0].realFeelTemperature.value, response.results[0].phrase, response.results[0].relativeHumidity];

                handleSpeechSynthesis();

                popup.setOptions({
                    content: content,
                    position: e.position
                });

                popup.open(map);
            });
        }

        // Function to search location based on user input and display results on the map.
        function search(userLatitude, userLongitude) {
            var query = document.getElementById('input').value;
             
            array[0] = query;

            searchDatasource.clear();
            routeDatasource.clear();
            document.getElementById('bestWayContent').innerText = '';
            document.getElementById('bestWay').style.display = 'none';

            setFalse();
            searchActive = true;

            // Perform a fuzzy search using Azure Maps Search API.
            searchURL.searchFuzzy(atlas.service.Aborter.timeout(10000), query, {
                lat: userLatitude,
                lon: userLongitude,
                radius: 100000,
                view: 'Auto'
            }).then(results => {
                //Get the results in GeoJSON format and add it to the data source.
                var data = results.geojson.getFeatures();  
                searchDatasource.add(data);
     
                handleSpeechSynthesis();
             
                map.setCamera({
                    bounds: data.bbox,
                    padding: 40
                });
            });
        }

        // Function to zoom the map in or out.
        function zoomMap(offset) {
            if(offset > 0){
                setFalse();
                zoomIn = true;
            }
            else{
                setFalse();
                zoomOut = true;
            }

            handleSpeechSynthesis();

            var cam = map.getCamera();

            // Adjust the map's camera to zoom within the allowed range.
            map.setCamera({
                zoom: Math.max(cam.minZoom, Math.min(cam.maxZoom, cam.zoom + offset)),
                type: 'ease',
                duration: 250
            })
        }

        //Number of degrees to change pitch the map per click.
        const pitchStep = 10;
        
        // Function to adjust the pitch of the map based on the provided offset.
        function pitchMap(offset) {
            if(offset > 0){
                setFalse();
                increasePitch = true;
            }
            else{
                setFalse();
                decreasePitch = true;
            }

            handleSpeechSynthesis();

            // Retrieve the current camera settings of the map and adjust pitch.
            map.setCamera({
                pitch: Math.max(0, Math.min(60, map.getCamera().pitch + offset * pitchStep)),
                type: 'ease',
                duration: 250
            })
        }

        //Number of degrees to change rotate the map per click.
        const bearingStep = 15;

        // Function to rotate the map based on the provided offset.
        function rotateMap(offset) {
            if(offset > 0){
                setFalse();
                rotateLeft = true;
            }
            else{
                setFalse();
                rotateRight = true;
            }

            handleSpeechSynthesis();

            // Retrieve the current camera settings of the map and adjust bearing (rotation).
            map.setCamera({
                bearing: map.getCamera().bearing + offset * bearingStep,
                type: 'ease',
                duration: 250
            })
        }
        
        //Function to calculate the route based on user input.
        async function calculateRoute() {
            closePopup();
            searchDatasource.clear();
            routeDatasource.clear();
            document.getElementById('bestWayContent').innerText = '';
            document.getElementById('bestWay').style.display = 'none';
            
            setFalse();
            calculateRouteActive = true;

            // Retrieve start and end locations and selected travel mode from the user input.
            var start = document.getElementById('startTbx').value;
            var end = document.getElementById('endTbx').value;
            var travelMode = document.getElementById('travelModeSelect').value;

            if (start == '' || end == '') {
                alert('Invalid waypoint point specified.');
                return;
            }

            // Geocode options for retrieving location coordinates.
            var geocodeOptions = {
                limit: 1,
                view: 'Auto'
            };

            // Geocode the start location.
            var startResult = await searchURL.searchAddress(atlas.service.Aborter.timeout(3000), start, geocodeOptions);

            if (startResult.results && startResult.results.length > 0) {
                var startPoint = [startResult.results[0].position.lon, startResult.results[0].position.lat];

                // Geocode the end location.
                var endResult = await searchURL.searchAddress(atlas.service.Aborter.timeout(3000), end, geocodeOptions);

            if (endResult.results && endResult.results.length > 0) {
                var endPoint = [endResult.results[0].position.lon, endResult.results[0].position.lat];

                // Create the route query based on start and end points.
                var query = `${startPoint[1]},${startPoint[0]}:${endPoint[1]},${endPoint[0]}`;

                // Calculate the route based on the selected travel mode.
                var directions;
                switch (travelMode) {
                    case 'car':
                        directions = await routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
                            travelMode: 'car',
                            sectionType: 'traffic',
                            maxAlternatives: 0
                        });
                        break;
                    case 'cycling':
                        directions = await routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
                            travelMode: 'bicycle',
                            sectionType: 'traffic',
                            maxAlternatives: 0
                        });
                        break;
                    case 'bike':
                        directions = await routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
                            travelMode: 'motorcycle',
                            sectionType: 'traffic',
                            maxAlternatives: 0
                        });
                        break;
                    case 'walking':
                        directions = await routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
                            travelMode: 'pedestrian',
                            sectionType: 'traffic',
                            maxAlternatives: 0
                        });
                        break;
                    default:
                        alert('Invalid travel mode.');
                        return;
                }

                // Get the route data as GeoJSON and add it to the data source.
                var routeData = directions.geojson.getFeatures();
                var route = routeData.features[0];
                route.properties.routeType = travelMode;

                // Add route and start/end points to routeDataSource.
                routeDatasource.add([
                    route,
                    new atlas.data.Feature(new atlas.data.Point(startPoint), {
                        title: start,
                        iconImage: 'pin-blue'
                    }),
                    new atlas.data.Feature(new atlas.data.Point(endPoint), {
                        title: end,
                        iconImage: 'pin-red'
                    }),
                ]);

                // Calculate and display carbon footprint based on travel mode.
                var carbonFootprint = route.properties.summary.lengthInMeters / 1000;
                var carbonFP = '';
                switch (travelMode) {
                    case 'car':
                        carbonFP = (carbonFootprint).toFixed(2) * 216 + " grams of CO₂"; 
                        document.getElementById('carbonfootprint').innerText = carbonFP
                        break;
                    case 'cycling':
                        carbonFP = carbonFootprint * 0 + " grams of CO₂";
                        document.getElementById('carbonfootprint').innerText = carbonFP;
                        break;
                    case 'bike':
                        carbonFP = (carbonFootprint * 120).toFixed(2) + " grams of CO₂";
                        document.getElementById('carbonfootprint').innerText = carbonFP;
                        break;
                    case 'walking':
                        carbonFP = carbonFootprint * 0 + " grams of CO₂";
                        document.getElementById('carbonfootprint').innerText = carbonFP;
                        break;
                    default:
                        alert('Invalid travel mode.');
                        return;
                }

                // Calculate and display distance in kilometers.
                var distanceInKm = route.properties.summary.lengthInMeters / 1000;
                document.getElementById('distanceSpan').innerText = distanceInKm.toFixed(2) + ' km';

                // Calculate and display travel time in hours and minutes.
                timeInSeconds = route.properties.summary.travelTimeInSeconds;
                var days = Math.floor(timeInSeconds / (60 * 60 * 24));
                var remainingSeconds = timeInSeconds % (60 * 60 * 24);
                var hours = Math.floor(remainingSeconds / 3600);
                var minutes = Math.round((remainingSeconds % 3600) / 60);

                var timeText = '';
                if (days > 0) {
                    timeText += days + ' day ';
                }
                timeText += hours + ' hours ' + minutes + ' minutes';

                document.getElementById('timeSpan').innerText = timeText;

                array = [travelMode, distanceInKm.toFixed(2), timeText, carbonFP];

                handleSpeechSynthesis();

                map.setCamera({
                    bounds: routeData.bbox,
                    padding: 30
                });
            } else {
                alert('Unable to geocode end waypoint.');
            }
        } else {
            alert('Unable to geocode start waypoint.');
        }
        
        document.getElementById('distanceRow').style.display = 'table-row';
        document.getElementById('timeRow').style.display = 'table-row';
        document.getElementById('carbonFootprintRow').style.display = 'table-row';
    }

        //Function to calculate and display routes for all available travel modes.
        async function showAllRoutes() {
            closePopup();
            searchDatasource.clear();
            routeDatasource.clear();
            
            document.getElementById('distanceSpan').innerText = '';
            document.getElementById('timeSpan').innerText = '';
            document.getElementById('carbonfootprint').innerText = '';
            document.getElementById('distanceRow').style.display = 'none';
            document.getElementById('timeRow').style.display = 'none';
            document.getElementById('carbonFootprintRow').style.display = 'none';
            document.getElementById('bestWayContent').innerText = '';
            document.getElementById('bestWay').style.display = 'none';

            // Check if bestWay is active, if so, do not set showAllRoutesActive or trigger speech synthesis. If not already active, set showAllRoutesActive flag and trigger speech synthesis.
            if(!bestWayActive){
                setFalse();
                showAllRoutesActive = true;
                handleSpeechSynthesis();
            }

            // Retrieve start and end locations from UI inputs.
            var start = document.getElementById('startTbx').value;
            var end = document.getElementById('endTbx').value;

            if (start == '' || end == '') {
                alert('Invalid waypoint point specified.');
                return;
            }

            // Geocode options for retrieving location coordinates.
            var geocodeOptions = {
                limit: 1,
                view: 'Auto'
            };

            // Geocode the start location.
            var startResult = await searchURL.searchAddress(atlas.service.Aborter.timeout(3000), start, geocodeOptions);

            if (startResult.results && startResult.results.length > 0) {
                var startPoint = [startResult.results[0].position.lon, startResult.results[0].position.lat];

                // Geocode the end location.
                var endResult = await searchURL.searchAddress(atlas.service.Aborter.timeout(3000), end, geocodeOptions);

                if (endResult.results && endResult.results.length > 0) {
                    var endPoint = [endResult.results[0].position.lon, endResult.results[0].position.lat];

                    var travelModes = ['car', 'bike', 'cycling', 'walking'];
                    for (var i = 0; i < travelModes.length; i++) {
                        var travelMode = travelModes[i];
                        var directions = await calculateSingleRoute(startPoint, endPoint, travelMode);
                        var routeData = directions.geojson.getFeatures();
                        var route = routeData.features[0];
                        route.properties.routeType = travelMode;
                        routeDatasource.add(route);
                    }

                    // Add pinpoints for starting and ending points to route data source.
                    routeDatasource.add([
                        new atlas.data.Feature(new atlas.data.Point(startPoint), {
                            title: start,
                            iconImage: 'pin-blue'
                        }),
                        new atlas.data.Feature(new atlas.data.Point(endPoint), {
                            title: end,
                            iconImage: 'pin-red'
                        })
                    ]);

                    map.setCamera({
                        bounds: routeData.bbox,
                        padding: 30
                    });
                } else {
                    alert('Unable to geocode end waypoint.');
                }
            } else {
                alert('Unable to geocode start waypoint.');
            }
        }

        //Function to calculate a route between two points based on the specified travel mode.
        async function calculateSingleRoute(startPoint, endPoint, travelMode) {
            var directions;

            closePopup();

            // Determine the travel mode and calculate the route accordingly.
            switch (travelMode) {
                case 'car':
                    directions = await routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
                        travelMode: 'car',
                        sectionType: 'traffic',
                        maxAlternatives: 0
                    });
                    break;
                case 'cycling':
                    directions = await routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
                        travelMode: 'bicycle',
                        sectionType: 'traffic',
                        maxAlternatives: 0
                    });
                    break;
                case 'bike':
                    directions = await routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
                        travelMode: 'motorcycle',
                        sectionType: 'traffic',
                        maxAlternatives: 0
                    });
                    break;
                case 'walking':
                    directions = await routeURL.calculateRouteDirections(atlas.service.Aborter.timeout(10000), [startPoint, endPoint], {
                        travelMode: 'pedestrian',
                        sectionType: 'traffic',
                        maxAlternatives: 0
                    });
                    break;
                default:
                    alert('Invalid travel mode.');
                    return;
            }

            return directions;
        }

        //Function to determine the optimal travel mode between two locations based on factors such as weather conditions, time of day, travel time and carbon footprint considerations.
        async function BestWay() {
            closePopup();

            searchDatasource.clear();
            routeDatasource.clear();

            document.getElementById('distanceSpan').innerText = '';
            document.getElementById('timeSpan').innerText = '';
            document.getElementById('carbonfootprint').innerText = '';
            document.getElementById('distanceRow').style.display = 'none';
            document.getElementById('timeRow').style.display = 'none';
            document.getElementById('carbonFootprintRow').style.display = 'none';
            document.getElementById('bestWayContent').innerText = '';
            document.getElementById('bestWay').style.display = 'none';
            
            setFalse();
            bestWayActive = true;

            // Trigger the function to show all possible routes.
            await showAllRoutes();

            // Retrieve start and end locations from user input fields.
            var start = document.getElementById('startTbx').value;
            var end = document.getElementById('endTbx').value;

            if (start == '' || end == '') {
                alert('Invalid waypoint point specified.');
                return;
            }

            // Options for geocoding API request.
            var geocodeOptions = {
                limit: 1,
                view: 'Auto'
            };

            // Geocode the start location.
            var startResult = await searchURL.searchAddress(atlas.service.Aborter.timeout(3000), start, geocodeOptions);

            if (startResult.results && startResult.results.length > 0) {
                var startPoint = [startResult.results[0].position.lon, startResult.results[0].position.lat];

                // Geocode the end location.
                var endResult = await searchURL.searchAddress(atlas.service.Aborter.timeout(3000), end, geocodeOptions);

                if (endResult.results && endResult.results.length > 0) {
                    var endPoint = [endResult.results[0].position.lon, endResult.results[0].position.lat];

                    // Check weather conditions at start location.
                    var weatherAtStart = await processRequest(currentConditionsUrl.replace('{query}', startPoint[1] + ',' + startPoint[0]));
                    var rainingAtStart = weatherAtStart && weatherAtStart.results && weatherAtStart.results[0] && weatherAtStart.results[0].phrase.includes('Rain');

                    if(rainingAtStart){
                        text = `It is raining at ${start} location, so Car is the best way to travel with the convenience and the speed it provides`;
                        document.getElementById('bestWayContent').innerText = text;
                        document.getElementById('bestWay').style.display = 'block';
                        handleSpeechSynthesis();
                        return;
                    }

                    // Check weather conditions at end location.
                    var weatherAtEnd = await processRequest(currentConditionsUrl.replace('{query}', endPoint[1] + ',' + endPoint[0]));
                    var rainingAtEnd = weatherAtEnd && weatherAtEnd.results && weatherAtEnd.results[0] && weatherAtEnd.results[0].phrase.includes('Rain');

                    if (rainingAtEnd) {
                        text = `It is raining at ${endPoint} location, so Car is the best way to travel with the convenience and the speed it provides`;
                        document.getElementById('bestWayContent').innerText = text;
                        document.getElementById('bestWay').style.display = 'block';
                        handleSpeechSynthesis();
                        return;
                    }

                    var localTime = '';

                    // Create the request URL with the coordinates.
                    var requestUrl = currentConditionsUrl.replace('{query}', startPoint[1] + ',' + startPoint[0]);

                    // Send a request to fetch local time information.
                    await processRequest(requestUrl).then(response => {
                        if (response && response.results && response.results.length > 0) {
                            var Data = response.results[0];
                            var dateTime = Data.dateTime;
                            var date = new Date(dateTime);
                            localTime = date.getHours();
                        }
                    })

                    //Check whether local time is suitable for walking
                    if(localTime <= 20 && localTime >= 6){
                        var walkingDirections = await calculateSingleRoute(startPoint, endPoint, 'walking');
                        var walkingTimeInSeconds = walkingDirections.geojson.getFeatures().features[0].properties.summary.travelTimeInSeconds;

                        if (walkingTimeInSeconds <= 3600 ) {
                            var minutes = Math.round((walkingTimeInSeconds % 3600) / 60);
                            text = "Walking is the Optimal mode to reach your destination.\n You can reach your destination in " + minutes + " minutes and also burn " + ((walkingTimeInSeconds/60)*4).toFixed(2) + " calories on your journey.\n By choosing to walk, you're making a positive impact on the environment by reducing carbon footprint and contributing to a healthier planet. \n Happy Walking :)";
                            document.getElementById('bestWayContent').innerText = text;
                            document.getElementById('bestWay').style.display = 'block';
                            handleSpeechSynthesis();
                            return;
                        }
                    }

                    //Check whether local time is suitable for cycling
                    if(localTime <= 20 && localTime >= 6){
                        var cyclingDirections = await calculateSingleRoute(startPoint, endPoint, 'cycling');
                        var cyclingTimeInSeconds = cyclingDirections.geojson.getFeatures().features[0].properties.summary.travelTimeInSeconds;
                        
                        if (cyclingTimeInSeconds <= 3600) {
                            var minutes = Math.round((cyclingTimeInSeconds % 3600) / 60);
                            text = "Cycling is the Optimal mode to reach your destination. \n You can arrive in " + minutes + " minutes and also burn " + ((walkingTimeInSeconds/60)*6.5).toFixed(2) + " calories on your journey. By choosing to cycle, you're helping to decrease your carbon footprint, reducing traffic congestion and supporting a healthier planet. Enjoy the ride and the positive impact you're making. \n Happy Cycling! 🚴";
                            document.getElementById('bestWayContent').innerText = text;
                            document.getElementById('bestWay').style.display = 'block';
                            handleSpeechSynthesis();
                            return;
                        }
                    }

                    //Check whether local time is suitable for cycling
                    var bikeDirections = await calculateSingleRoute(startPoint, endPoint, 'bike');
                    var bikeTimeInSeconds = bikeDirections.geojson.getFeatures().features[0].properties.summary.travelTimeInSeconds;
                    
                    if((localTime + bikeTimeInSeconds/3600) <= 22 && localTime >= 6){
                        if (bikeTimeInSeconds <= 10800) {
                            text = "Bike is the Optimal mode to reach your destination. \n You can arrive in " + (bikeTimeInSeconds/3600).toFixed(2) + " hrs and also biking releases 53% less carbon footprint than a car, making it a better choice. \n Happy Biking!🚴‍♂️"; 
                            document.getElementById('bestWayContent').innerText = text;
                            document.getElementById('bestWay').style.display = 'block';
                            handleSpeechSynthesis();
                            return;
                        }
                    }

                    //Recommend car if other conditions are not met.
                    var carDirections = await calculateSingleRoute(startPoint, endPoint, 'car');
                    var carTimeInSeconds = carDirections.geojson.getFeatures().features[0].properties.summary.travelTimeInSeconds;
                    text = "Car is the Optimal mode to reach your destination with the convenience and speed that a car provides. \n However, it's important to be mindful of the higher carbon footprint associated with car travel.\n Consider carpooling or using fuel-efficient vehicles to reduce environmental impact \n Safe travels!🚗";
                    document.getElementById('bestWayContent').innerText = text;
                    document.getElementById('bestWay').style.display = 'block';
                    handleSpeechSynthesis();
                    return;
                } else {
                    alert('Unable to geocode end waypoint.');
                }
            } else {
                alert('Unable to geocode start waypoint.');
            }
            
            document.getElementById('bestWay').style.display = 'block';
        }

        //Function to calculate the current local time at the given location.
        async function getCurrentLocalTime(coords) {
            //Request the current conditions.
            var requestUrl = currentConditionsUrl.replace('{query}', coords[1] + ',' + coords[0]);

            processRequest(requestUrl).then(response => {
                var dateTime = response.dateTime;
                var time = new Date(dateTime);
                var hour = time.getHours();

                return hour;
            });
        }

        //Function to show Popup
        function showPopup(e) {
            if (e.shapes && e.shapes.length > 0) {
                // Set cursor style to 'pointer' to indicate clickable element.
                map.getCanvasContainer().style.cursor = 'pointer';

                // Get properties of the first shape in the event.
                var properties = e.shapes[0].getProperties();

                popup.setOptions({
                    content: `<div style="padding:10px;"><b>${properties.simpleCategory}</b><br/>Speed: ${Math.round(properties.effectiveSpeedInKmh * 0.62137119)} mph</div`,
                    position: e.position
                });

                popup.open(map);
            }
        }

        //Function to close Popup
        function closePopup() {
            popup.close();
            map.getCanvasContainer().style.cursor = 'grab';
        }

        function symbolClicked(e) {
            //Make sure the event occurred on a point feature.
            if (e.shapes && e.shapes.length > 0 && e.shapes[0].getType() === 'Point') {
                var properties = e.shapes[0].getProperties();

                var html = ['<div style="padding:10px;"><span style="font-size:14px;font-weight:bold;">'];
                var addressInTitle = false;

                if (properties.type === 'POI' && properties.poi && properties.poi.name) {
                    html.push(properties.poi.name);
                } else if (properties.address && properties.address.freeformAddress) {
                    html.push(properties.address.freeformAddress);
                    addressInTitle = true;
                }

                html.push('</span><br/>');

                if (!addressInTitle && properties.address && properties.address.freeformAddress) {
                    html.push(properties.address.freeformAddress, '<br/>');
                }

                html.push('<b>Type: </b>', properties.type, '<br/>');

                if (properties.entityType) {
                    html.push('<b>Entity Type: </b>', properties.entityType, '<br/>');
                }

                if (properties.type === 'POI' && properties.poi) {
                    if (properties.poi.phone) {
                        html.push('<b>Phone: </b>', properties.poi.phone, '<br/>');
                    }

                    if (properties.poi.url) {
                        html.push('<b>URL: </b>', properties.poi.url, '<br/>');
                    }

                    if (properties.poi.classifications) {
                        html.push('<b>Classifications:</b><br/>');
                        for (var i = 0; i < properties.poi.classifications.length; i++) {
                            for (var j = 0; j < properties.poi.classifications[i].names.length; j++) {
                                html.push(' - ', properties.poi.classifications[i].names[j].name, '<br/>');
                            }
                        }
                    }

                }

                html.push('</div>');

                popup.setOptions({
                    content: html.join(''),
                    position: e.shapes[0].getCoordinates()
                });

                popup.open(map);
            }
        }

        //Function to set all the flags to false, to indicate their inactive state.
        function setFalse(){
            weatherForPointActive=false; 
            searchActive=false; 
            calculateRouteActive=false; 
            showAllRoutesActive=false; 
            bestWayActive=false; 
            zoomIn=false; 
            zoomOut=false; 
            displayTraffic=false; 
            decreasePitch=false; 
            increasePitch=false; 
            rotateRight=false; 
            rotateLeft=false;
        }

        // Integrating Speech Services

        // Function to toggle the voice assistant feature on/off.
        function toggleVoiceAssistant() {
            // Toggle the state of voice assistant enabled/disabled.
            voiceAssistantEnabled = !voiceAssistantEnabled;

            const button = document.getElementById('voiceAssistantButton');

            // Depending on the state of voice assistant, update the button and speak appropriate message.
            if (voiceAssistantEnabled) {
                speakText("Voice assistant is now enabled.");
                button.style.backgroundColor = 'lightblue';
            } else {
                speakText("Voice assistant is now disabled.");
                button.style.backgroundColor = 'white';
            }
        }

        // Function to handle speech synthesis based on active flags and current context.
        function handleSpeechSynthesis() {
            // Check if voice assistant is enabled
            if (voiceAssistantEnabled) {
                // Speak weather information if WeatherForPoint is active
                if (weatherForPointActive) {
                    speakText(`This is the current weather update for your selected location.\n The weather condition at the location is ${array[2]}. \n The temperature here is ${array[0]} degree celsius. \n However, the real feel is like ${array[1]} degree celsius. \n Also, the humidity at this place is ${array[3]} percent`);
                } 
                // Speak search results if SearchActive is active
                else if (searchActive) {
                    speakText(`Here are the search results for the location ${array[0]}. \nClick on the points to explore more details about each place.`);
                } 
                // Speak route details if CalculateRouteActive is active
                else if (calculateRouteActive) {
                    speakText(`This is the travel route to your destination by ${array[0]}.\n The distance from your starting point to the destination is ${array[1]} kilometers. \n The estimated travel time to reach your destination is ${array[2]}. \n The estimated carbon footprint for your journey is approximately ${array[3]}.`);
                }
                // Speak all routes details if ShowAllRoutesActive is active
                else if(showAllRoutesActive){
                    speakText("The four ways to reach your destination -- by car, bike, bicycle and walking -- are shown here. \n You can choose any of these routes to reach your destination.");
                } 
                // Speak best way details if BestWayActive is active
                else if(bestWayActive){
                    // Speak the text determined as the best way
                    speakText(text);
                }
                // Speak zoom in action if ZoomIn is active
                else if(zoomIn){
                    speakText("Zooming In");
                }
                // Speak zoom out action if ZoomOut is active
                else if(zoomOut){
                    speakText("Zooming Out");
                }
                // Speak pitch increase action if IncreasePitch is active
                else if(increasePitch){
                    speakText("Increasing Pitch");
                }
                // Speak pitch decrease action if DecreasePitch is active
                else if(decreasePitch){
                    speakText("Decreasing Pitch");
                }
                // Speak rotate left action if RotateLeft is active
                else if(rotateLeft){
                    speakText("Rotating map to the Left");
                }
                // Speak rotate right action if RotateRight is active
                else if(rotateRight){
                    speakText("Rotating map to the right");
                }
                // Default message when no specific state matches
                else {
                    speakText("Hello! Welcome to Maps! \n Here are the avaliable features :  \n 1. Search for a location \n 2. Get directions to a destination \n 3. Check the weather conditions \n 4. Change map style \n 5. Display traffic \n 6. Zoom in or out \n 7. Adjust pitch angle \n 8. Rotate the map left or right");
                }
            }
        }

        // Function to speak the provided text using Speech SDK
        function speakText(text) {
            // Configure Speech SDK with subscription key and region
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(speechAPIKey, region);

            // Create a SpeechSynthesizer instance
            const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig);

            // Call asynchronous method to speak the provided text
            synthesizer.speakTextAsync(text);
        }

    </script>
