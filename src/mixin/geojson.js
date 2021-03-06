/* global L */
/* jshint camelcase: false */

'use strict';

var topojson = require('../util/topojson');
var util = require('../util/util');

module.exports = {
  _types: {
    'LineString': 'line',
    'MultiLineString': 'line',
    'Point': 'point',
    'Polygon': 'polygon'
  },
  addData: function (feature) {
    if (/\btopology\b/i.test(feature.type)) {
      for (var prop in feature.objects) {
        var geojson = topojson.feature(feature, feature.objects[prop]);

        this._checkGeometryType(geojson);
        L.GeoJSON.prototype.addData.call(this, geojson);
      }
    } else {
      this._checkGeometryType(feature);
      L.GeoJSON.prototype.addData.call(this, feature);
    }
  },
  onAdd: function (map) {
    this._map = map;
    this._addAttribution();

    if (this.options.zoomToBounds) {
      this.on('ready', function () {
        map.fitBounds(this.getBounds());
      });
    }

    L.GeoJSON.prototype.onAdd.call(this, map);
  },
  onRemove: function (map) {
    delete this._map;
    this._removeAttribution();
    L.GeoJSON.prototype.onRemove.call(this, map);
  },
  _addAttribution: function () {
    var attribution = this.options.attribution;

    if (attribution && this._map.attributionControl) {
      this._map.attributionControl.addAttribution(attribution);
    }
  },
  _checkGeometryType: function (feature) {
    if (!this._geometryTypes) {
      this._geometryTypes = [];
    }

    if (feature.geometry && feature.geometry.type) {
      var type = this._types[feature.geometry.type];

      if (this._geometryTypes.indexOf(type) === -1) {
        this._geometryTypes.push(type);
      }
    }
  },
  _removeAttribution: function () {
    var attribution = this.options.attribution;

    if (attribution && this._map.attributionControl) {
      this._map.attributionControl.removeAttribution(attribution);
    }
  },
  _toLeaflet: function (config) {
    // TODO: Support preset colors. Setup a "colorProperties" array that contains the name of the properties that can contain colors, then use those to pull in presets.
    // TODO: Support handlebars templates.
    var configStyles;
    var matchSimpleStyles = {
      'fill': 'fillColor',
      'fill-opacity': 'fillOpacity',
      'stroke': 'color',
      'stroke-opacity': 'opacity',
      'stroke-width': 'weight'
    };

    if (typeof config.clickable === 'undefined' || config.clickable === true) {
      var activeTip = null;
      var detectAvailablePopupSpace = true;
      var lastTarget = null;
      var map = null;

      // TODO: If typeof config.onEachFeature === 'function', save it and call it.
      config.onEachFeature = function (feature, layer) {
        var clicks = 0;

        layer.on('click', function (e) {
          var target = e.target;

          if (!map) {
            map = target._map;
            map.on('click', function () {
              if (lastTarget) {
                lastTarget
                  .closePopup()
                  .unbindPopup();
                lastTarget = null;
              }
            });

            if (typeof map.options.detectAvailablePopupSpace !== 'undefined' && map.options.detectAvailablePopupSpace === false) {
              detectAvailablePopupSpace = false;
            }
          }

          if (map._controllingInteractivity === 'map') {
            clicks = 0;

            setTimeout(function () {
              if (!clicks) {
                if (lastTarget && (lastTarget._leaflet_id === target._leaflet_id)) {
                  lastTarget
                    .closePopup()
                    .unbindPopup();
                  lastTarget = null;
                } else {
                  var container = map.getContainer();
                  var popup = L.npmap.popup({
                    autoPanPaddingTopLeft: util._getAutoPanPaddingTopLeft(container),
                    maxHeight: (detectAvailablePopupSpace ? util._getAvailableVerticalSpace(map) - 84 : null),
                    maxWidth: (detectAvailablePopupSpace ? util._getAvailableHorizontalSpace(map) - 77 : null)
                  });
                  var properties = feature.properties;
                  var html = popup._resultToHtml(properties, config.popup, null, null, map.options.popup);

                  if (lastTarget) {
                    lastTarget
                      .closePopup()
                      .unbindPopup();
                    lastTarget = null;
                  }

                  if (html) {
                    if (typeof html === 'string') {
                      html = util.unescapeHtml(html);
                    }

                    if (feature.geometry.type === 'Point') {
                      popup.setContent(html);
                      target
                        .bindPopup(popup)
                        .openPopup();
                      lastTarget = target;
                    } else {
                      popup
                        .setContent(html)
                        .setLatLng(e.latlng.wrap())
                        .openOn(target._map);
                    }
                  }
                }
              }
            }, 200);
          } else {
            map.fireEvent('click', e);
          }
        });
        layer.on('dblclick', function (e) {
          clicks++;
          e.containerPoint = e.target._map.latLngToContainerPoint(e.latlng);
          e.target._map.fireEvent('dblclick', e);
        });
        layer.on('mouseout', function (e) {
          if (activeTip) {
            var removeIndex = null;
            var tooltips = e.target._map._tooltips;

            for (var i = 0; i < tooltips.length; i++) {
              var obj = tooltips[i];

              if (activeTip.layerId === obj.layerId) {
                removeIndex = i;
                break;
              }
            }

            if (removeIndex !== null) {
              tooltips.splice(removeIndex, 1);
            }

            activeTip = null;
          }
        });
        layer.on('mouseover', function (e) {
          var tooltipConfig = config.tooltip;

          if (tooltipConfig) {
            var properties = feature.properties;
            var tip;

            if (typeof tooltipConfig === 'function') {
              tip = tooltipConfig(properties);
            } else if (typeof tooltipConfig === 'string') {
              tip = util.handlebars(tooltipConfig, properties);
            }

            if (tip) {
              var target = e.target;
              var obj = {
                html: tip,
                layerId: target._leaflet_id
              };

              target._map._tooltips.push(obj);
              activeTip = obj;
            }
          }
        });
      };
    }

    config.pointToLayer = function (feature, latLng) {
      // TODO: Support L.CircleMarker and L.Icon
      var configStyles;
      var icon = {
        'marker-color': '#000000',
        'marker-size': 'medium',
        'marker-library': 'maki',
        'marker-symbol': null
      };
      var properties = feature.properties;
      var property;
      var value;

      configStyles = typeof config.styles === 'function' ? config.styles(properties) : config.styles;

      if (!configStyles || !configStyles.point) {
        for (property in icon) {
          value = properties[property];

          if (value) {
            icon[property] = value;
          }
        }

        icon = L.npmap.icon[icon['marker-library']](icon);
      } else {
        configStyles = typeof configStyles.point === 'function' ? configStyles.point(properties) : configStyles.point;

        if (configStyles) {
          if (typeof configStyles.iconUrl === 'string') {
            icon = new L.Icon(configStyles);
          } else {
            for (property in icon) {
              value = configStyles[property];

              if (value) {
                icon[property] = value;
              }
            }

            if (!configStyles.ignoreFeatureStyles) {
              for (property in icon) {
                value = properties[property];

                if (value) {
                  icon[property] = value;
                }
              }
            }

            icon = L.npmap.icon[icon['marker-library']](icon);
          }
        } else {
          if (!configStyles.ignoreFeatureStyles) {
            for (property in icon) {
              value = properties[property];

              if (value) {
                icon[property] = value;
              }
            }
          }

          icon = L.npmap.icon[icon['marker-library']](icon);
        }
      }

      return new L.Marker(latLng, L.extend(config, {
        icon: icon,
        keyboard: false
      }));
    };
    config.style = function (feature) {
      var type = (function () {
        var t = feature.geometry.type.toLowerCase();

        if (t.indexOf('line') !== -1) {
          return 'line';
        } else if (t.indexOf('point') !== -1) {
          return 'point';
        } else if (t.indexOf('polygon') !== -1) {
          return 'polygon';
        }
      })();

      if (type !== 'point') {
        // TODO: Add support for passing Leaflet styles in.
        var count = 0;
        var style = {};
        var properties;
        var property;

        if (typeof feature.properties === 'object') {
          properties = feature.properties;
        } else {
          properties = {};
        }

        for (property in matchSimpleStyles) {
          if (typeof properties[property] !== 'undefined' && properties[property] !== null && properties[property] !== '') {
            style[matchSimpleStyles[property]] = properties[property];
          }
        }

        configStyles = typeof config.styles === 'function' ? config.styles(properties) : config.styles;

        if (configStyles) {
          configStyles = typeof configStyles[type] === 'function' ? configStyles[type](properties) : configStyles[type];

          if (configStyles) {
            for (property in matchSimpleStyles) {
              if (typeof configStyles[property] !== 'undefined' && configStyles[property] !== null && configStyles[property] !== '') {
                style[matchSimpleStyles[property]] = configStyles[property];
              }
            }
          }
        }

        for (property in style) {
          count++;
          break;
        }

        if (count) {
          return style;
        }
      }
    };

    return config;
  }
};
