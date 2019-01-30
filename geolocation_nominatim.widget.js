(function ($) {
    Drupal.geolocationNominatimWidget = function(mapSettings, context, updateCallback) {
        // Only init once.
        if ($('#' + mapSettings.id).hasClass('leaflet-container')) {
            return;
        }
        // Init map.
        var map = L.map(mapSettings.id).setView([mapSettings.centerLat, mapSettings.centerLng], mapSettings.zoom);
        L.tileLayer(mapSettings.tileServerUrl, {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Init geocoder.
        var geocodingQueryParams = {};
        if (mapSettings.limitCountryCodes != '' || mapSettings.limitViewbox != '' ) {
            geocodingQueryParams = {
                'countrycodes' : mapSettings.limitCountryCodes,
                'viewbox': mapSettings.limitViewbox,
                'bounded': 1
            };
        }
       
        var geocoderNominatim = L.Control.Geocoder.nominatim({
            // Todo: Make this an optional setting.
            geocodingQueryParams: geocodingQueryParams,
            reverseQueryParams: {
                extratags: 1,
                namedetails: 0,
                addressdetails: 1
            }
        });
        
        var geocoder = L.Control.geocoder({
            defaultMarkGeocode: false,
            collapsed: false,
            geocoder: geocoderNominatim
        });

        var marker;

        // Init default values.
        if (mapSettings.lat && mapSettings.lng) {
            var result = {
                center: [mapSettings.lat, mapSettings.lng],
                name: mapSettings.label
            };
            setMarker(result);
            map.setView([mapSettings.lat, mapSettings.lng], mapSettings.zoom);
        }

        function setMarker(result) {
            if (marker) {
                map.removeLayer(marker);
            }
            marker = L.marker(result.center, {
                draggable: true
            }).bindPopup(result.html || result.name).addTo(map).openPopup();
            marker.on('dragend', function(e) {
                updateCallback(marker, map, result);
            });
            updateCallback(marker, map, result);
        }

        geocoder.on('markgeocode', function(result) {

            console.log('print result.geocode');
            console.log(result);
            var bbox = result.geocode.properties.geojson;
            console.log('print geojson');
            console.log(bbox);
            var poly = L.geoJSON(bbox).addTo(map);
            map.fitBounds(poly.getBounds());


            //this._map.fitBounds(result.geocode.bbox);
            //setMarker(result.geocode);
        });

        map.on('click', function(e) {
            console.log('map.on click called');
            if (e.latlng !== undefined && e.latlng !== null) {
                console.log('variable e.latlng exists');
                geocoder.options.geocoder.reverse(e.latlng, map.options.crs.scale(map.getZoom()), function(results) {
                    if (results[0]) {
                        setMarker(results[0])
                    }
                // Todo: Handle case when nothing is found.
                })
            }
            
        });

        geocoder.addTo(map);
    };

    Drupal.geolocationNominatimSetAddressField = function(mapSettings, result, context) {
        if (! ('properties' in result && 'address' in result.properties)) {
            return;
        }
        var address = result.properties.address;
        var $form = $('.geolocation-widget-lat.for--' + mapSettings.id, context).parents('form');
        var $address = $form.find('.field--type-address').first();

        // Bind to addressfields AJAX complete event.
        $.each(Drupal.ajax.instances, function(idx, instance) {
            // Todo: Simplyfy this check.
            if (instance !== null && instance.hasOwnProperty('callback')
                && instance.callback[0] == 'Drupal\\address\\Plugin\\Field\\FieldWidget\\AddressDefaultWidget'
                && instance.callback[1] == 'ajaxRefresh') {
                var originalSuccess= instance.options.success;
                instance.options.success = function(response, status, xmlhttprequest) {
                    originalSuccess(response, status, xmlhttprequest);
                    var $addressNew = $form.find('.field--type-address').first();
                    Drupal.geolocationNominatimSetAddressDetails($addressNew, address);
                }
            }
        });

        if ($('select.country', $address).val().toLowerCase() != address.country_code) {
            $('select.country', $address).val(address.country_code.toUpperCase()).trigger('change');
        }
        else {
            Drupal.geolocationNominatimSetAddressDetails($address, address);
        }
    },

    Drupal.geolocationNominatimSetAddressDetails = function($address, details) {
        if ('postcode' in details) {
            $('input.postal-code', $address).val(details.postcode);
        }
        if ('city' in details || 'town' in details) {
            var locality = details.city ? details.city : details.town;
            $('input.locality', $address).val(locality);
        }
        if ('road' in details) {
            $('input.address-line1', $address).val(details.road);
        }
        if ('house_number' in details) {
            $('input.address-line1', $address).val($('input.address-line1', $address).val() + ' ' + details.house_number);
        }
    },

    Drupal.behaviors.geolocationNominatimWidget = {
        attach: function (context, settings) {
            if (settings.geolocationNominatim.widgetMaps) {
                $.each(settings.geolocationNominatim.widgetMaps, function (index, mapSettings) {
                    Drupal.geolocationNominatimWidget(mapSettings, context, function (marker, map, result) {
                        $('.geolocation-widget-lat.for--' + mapSettings.id, context).attr('value', marker.getLatLng().lat);
                        $('.geolocation-widget-lng.for--' + mapSettings.id, context).attr('value', marker.getLatLng().lng);
                        $('.geolocation-widget-zoom.for--' + mapSettings.id, context).attr('value', map.getZoom());
                        if (mapSettings.setAddressField) {
                            Drupal.geolocationNominatimSetAddressField(mapSettings, result, context);
                        }
                    });
                });
            }
        }
    }
})(jQuery);
