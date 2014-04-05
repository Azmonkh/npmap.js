/* global L, NPMap */

'use strict';

var baselayerPresets = require('./preset/baselayers.json'),
  colorPresets = require('./preset/colors.json'),
  humane = require('humane-js'),
  nanobar = require('nanobar'),
  overlayPresets = require('./preset/overlays.json'),
  util = require('./util/util');

require('./popup.js');

(function() {
  var style = colorPresets.gold;

  L.Circle.mergeOptions(style);
  L.CircleMarker.mergeOptions(style);
  L.Control.Attribution.mergeOptions({
    prefix: '<a href="http://www.nps.gov/npmap/disclaimer.html" target="_blank">Disclaimer</a>'
  });
  L.Map.addInitHook(function() {
    var me = this;

    function resize() {
      var container = me.getContainer(),
        left = util.getOuterDimensions(util.getChildElementsByClassName(container, 'leaflet-control-container')[0].childNodes[2]).width;

      if (left) {
        left = left + 20;
      }

      util.getChildElementsByClassName(container, 'leaflet-control-attribution')[0].style['max-width'] = (util.getOuterDimensions(container).width - left) + 'px';
    }

    if (this.options.attributionControl) {
      this.attributionControl._update = function() {
        var attribs = [],
          prefixAndAttribs = [];

        for (var attribution in this._attributions) {
          if (this._attributions[attribution] > 0) {
            var i = -1;

            if (attribution) {
              for (var j = 0; j < attribs.length; j++) {
                if (attribs[j] === attribution) {
                  i = j;
                  break;
                }
              }

              if (i === -1) {
                attribs.push(attribution);
              }
            }
          }
        }

        if (this.options.prefix) {
          prefixAndAttribs.push(this.options.prefix);
        }

        if (attribs.length) {
          prefixAndAttribs.push(attribs.join(' | '));
        }

        this._container.innerHTML = prefixAndAttribs.join(' | ');
      };
      this.on('resize', resize);
      resize();
    }
  });
  L.Polygon.mergeOptions(style);
  L.Polyline.mergeOptions({
    color: style.color,
    opacity: style.opacity,
    weight: style.weight
  });
})();

var Map = L.Map.extend({
  initialize: function(config) {
    var baseLayerSet = false,
      container = L.DomUtil.create('div', 'npmap-container'),
      map = L.DomUtil.create('div', 'npmap-map'),
      mapWrapper = L.DomUtil.create('div', 'npmap-map-wrapper'),
      me = this,
      modules = L.DomUtil.create('div', 'npmap-modules'),
      npmap = L.DomUtil.create('div', 'npmap' + ((L.Browser.ie6 || L.Browser.ie7) ? ' npmap-oldie' : '') + (L.Browser.retina ? ' npmap-retina' : '')),
      toolbar = L.DomUtil.create('div', 'npmap-toolbar'),
      toolbarLeft = L.DomUtil.create('ul', 'left'),
      toolbarRight = L.DomUtil.create('ul', 'right'),
      zoomifyMode = false;

    config = me._toLeaflet(config);
    config.div.insertBefore(npmap, config.div.hasChildNodes() ? config.div.childNodes[0] : null);
    npmap.appendChild(modules);
    npmap.appendChild(container);
    toolbar.appendChild(toolbarLeft);
    toolbar.appendChild(toolbarRight);
    container.appendChild(toolbar);
    container.appendChild(mapWrapper);
    mapWrapper.appendChild(map);
    config.div = map;
    config.zoomControl = false;
    L.Map.prototype.initialize.call(me, config.div, config);
    me._controllingCursor = true;
    me._controllingInteractivity = true;
    me._defaultCursor = me.getContainer().style.cursor;
    me.on('autopanstart', function() {
      me._setCursor('');
    });
    this._notify = humane.create({
      baseCls: 'humane-bootstrap',
      container: map,
    });
    this._notify.danger = this._notify.spawn({
      addnCls: 'humane-bootstrap-danger'
    });
    this._notify.info = this._notify.spawn({
      addnCls: 'humane-bootstrap-info'
    });
    this._notify.success = this._notify.spawn({
      addnCls: 'humane-bootstrap-success'
    });
    this._notify.warning = this._notify.spawn({
      addnCls: 'humane-bootstrap-warning'
    });
    this._progress = new nanobar({
      bg: '#d29700',
      id: 'npmap-progress',
      target: map
    });

    if (!me._loaded) {
      me.setView(config.center, config.zoom);
    }

    if (config.baseLayers.length) {
      var zoomify = [],
        baseLayer, i;

      for (i = 0; i < config.baseLayers.length; i++) {
        baseLayer = config.baseLayers[i];

        if (baseLayer.type === 'zoomify') {
          zoomify.push(baseLayer);
        }
      }

      if (zoomify.length) {
        zoomifyMode = true;

        for (i = 0; i < zoomify.length; i++) {
          baseLayer = zoomify[i];

          if (baseLayer.visible || typeof baseLayer.visible === 'undefined') {
            baseLayer.visible = true;
            baseLayer.L = L.npmap.layer.zoomify(baseLayer).addTo(me);
            break;
          }
        }
      } else {
        for (i = 0; i < config.baseLayers.length; i++) {
          baseLayer = config.baseLayers[i];
          baseLayer.zIndex = 0;

          if (!baseLayerSet && (baseLayer.visible || typeof baseLayer.visible === 'undefined')) {
            baseLayer.visible = true;
            baseLayerSet = true;

            if (baseLayer.type === 'arcgisserver') {
              baseLayer.L = L.npmap.layer[baseLayer.type][baseLayer.tiled === true ? 'tiled' : 'dynamic'](baseLayer);
            } else {
              baseLayer.L = L.npmap.layer[baseLayer.type](baseLayer);
            }

            me.addLayer(baseLayer.L);
          } else {
            baseLayer.visible = false;
          }
        }
      }
    }

    if (!zoomifyMode && config.overlays.length) {
      var zIndex = 1;

      for (var j = 0; j < config.overlays.length; j++) {
        var overlay = config.overlays[j];

        if (overlay.type === 'zoomify') {
          throw new Error('Zoomify layers can only be added in the "baseLayers" config property.');
        } else {
          if (overlay.visible || typeof overlay.visible === 'undefined') {
            overlay.visible = true;
            overlay.zIndex = zIndex;

            if (overlay.type === 'arcgisserver') {
              overlay.L = L.npmap.layer[overlay.type][overlay.tiled === true ? 'tiled' : 'dynamic'](overlay);
            } else {
              overlay.L = L.npmap.layer[overlay.type](overlay);
            }

            me.addLayer(overlay.L);
            zIndex++;
          } else {
            overlay.visible = false;
          }
        }
      }
    }

    me._initializeModules();
    me._setupPopup();
    me._setupTooltip();

    return this;
  },
  _initializeModules: function() {
    if (this.options && this.options.modules && L.Util.isArray(this.options.modules) && this.options.modules.length) {
      var initialize = null,
        me = this,
        modules = this.options.modules,
        button, i;

      this._divWrapper = this._container.parentNode.parentNode;
      this._divModules = util.getChildElementsByClassName(this._divWrapper.parentNode.parentNode, 'npmap-modules')[0];
      this._divModuleButtons = L.DomUtil.create('div', 'npmap-modules-buttons', this._container.parentNode);
      this._buttonCloseModules = L.DomUtil.create('button', 'npmap-modules-buttons-button', this._divModuleButtons);
      this._buttonCloseModules.style['background-image'] = 'url(' + NPMap.path + '/images/font-awesome/times' + (L.Browser.retina ? '@2x' : '') + '.png)';
      this._buttonCloseModules.title = 'Close';
      L.DomEvent.addListener(this._buttonCloseModules, 'click', me.closeModules, this);

      for (i = 0; i < modules.length; i++) {
        var module = modules[i],
          title = module.title,
          div = L.DomUtil.create('div', 'module', this._divModules);

        button = L.DomUtil.create('button', 'npmap-modules-buttons-button', this._divModuleButtons);
        button.id = 'npmap-modules-buttons|' + title.replace(/ /g, '_');
        button.title = title;
        button.style['background-image'] = 'url(' + NPMap.path + '/images/font-awesome/' + module.icon + (L.Browser.retina ? '@2x' : '') + '.png)';
        div.id = 'npmap-module|' + title.replace(/ /g, '_');

        if (module.type === 'custom') {
          div.innerHTML = '<h2 class="title">' + title + '</h2><div class="content">' + module.content + '</div>';
        } else {
          // TODO: Get HTML from NPMap.js module.
        }

        L.DomEvent.addListener(button, 'click', function() {
          me.showModule(this.id.replace('npmap-modules-buttons|', ''));
        });

        if (!initialize && module.visible === true) {
          initialize = module.title;
        }
      }

      if (initialize) {
        this.showModule(initialize);
      } else {
        for (i = 1; i < this._divModuleButtons.childNodes.length; i++) {
          button = this._divModuleButtons.childNodes[i];
          button.style.display = 'inline-block';
        }
      }
    }
  },
  _setCursor: function(type) {
    this._container.style.cursor = type;
  },
  _setupPopup: function() {
    var clicks = 0,
      delayClick = false,
      me = this,
      canceled, changed, hasArcGisServer;

    function done() {
      me
        .off('click', setCanceled)
        .off('dragstart', setChanged)
        .off('movestart', setChanged)
        .off('zoomstart', setChanged);

      if (hasArcGisServer) {
        me._progress.go(100);
      }
    }
    function go(e) {
      var queryable = [];

      canceled = false;
      changed = false;
      me
        .on('click', setCanceled)
        .on('dragstart', setChanged)
        .on('movestart', setChanged)
        .on('zoomstart', setChanged);

      for (var layerId in me._layers) {
        layer = me._layers[layerId];

        if (typeof layer.options === 'object' && (typeof layer.options.popup === 'undefined' || layer.options.popup !== false) && typeof layer._handleClick === 'function' && layer._hasInteractivity !== false) {
          queryable.push(layer);
        }
      }

      if (queryable.length) {
        var completed = 0,
          intervals = 0,
          latLng = e.latlng.wrap(),
          results = [],
          i, interval;

        hasArcGisServer = false;

        for (i = 0; i < queryable.length; i++) {
          layer = queryable[i];

          if (layer.options && layer.options.type === 'arcgisserver') {
            hasArcGisServer = true;
          }

          layer._handleClick(latLng, function(result) {
            if (result) {
              results.push(result);
            }

            completed++;
          });
        }

        if (hasArcGisServer) {
          me._progress.go(1);
        }

        interval = setInterval(function() {
          intervals++;

          if (hasArcGisServer) {
            me._progress.go(intervals);
          }

          if (canceled || changed) {
            clearInterval(interval);
            done();
          } else if ((queryable.length === completed) || intervals > 98) {
            clearInterval(interval);
            done();

            if (intervals > 98) {
              // TODO: Show non-modal alert about the timeout.
            }

            if (results.length) {
              var popup = L.npmap.popup({
                autoPanPaddingTopLeft: util._getAutoPanPaddingTopLeft(me.getContainer()),
                maxHeight: util._getAvailableVerticalSpace(me) - 74
              });
              popup.setContent(popup._handleResults(results)).setLatLng(latLng).openOn(me);
            }
          }
        }, 100);
      }
    }
    function setCanceled() {
      canceled = true;
    }
    function setChanged() {
      changed = true;
    }

    for (var layerId in me._layers) {
      var layer = me._layers[layerId];

      if (typeof layer.options === 'object' && layer.options.type === 'arcgisserver') {
        delayClick = true;
        break;
      }
    }

    if (delayClick) {
      me.on('dblclick', function() {
        clicks++;
      });
    }

    me.on('click', function(e) {
      clicks = 0;

      if (me._controllingInteractivity) {
        if (delayClick) {
          setTimeout(function() {
            if (!clicks) {
              go(e);
            }
          }, 200);
        } else {
          go(e);
        }
      }
    });
  },
  _setupTooltip: function() {
    var activeTips = [],
      me = this,
      tooltip = L.npmap.tooltip({
        map: me,
        padding: '7px 10px'
      });

    me._tooltips = [];

    L.DomEvent.on(util.getChildElementsByClassName(me.getContainer(), 'leaflet-popup-pane')[0], 'mousemove', function(e) {
      L.DomEvent.stopPropagation(e);
      tooltip.hide();
    });
    me.on('mousemove', function(e) {
      if (this._controllingCursor) {
        var hasData = false,
          latLng = e.latlng.wrap(),
          newActiveTips = [];

        tooltip.hide();
        
        if (me.getContainer().style.cursor !== 'wait') {
          me._setCursor('');
        }

        for (var i = 0; i < me._tooltips.length; i++) {
          if (activeTips.indexOf(me._tooltips[i]) === -1) {
            newActiveTips.push(me._tooltips[i]);
          }
        }

        activeTips = [];
        me._tooltips = newActiveTips;

        for (var layerId in me._layers) {
          var layer = me._layers[layerId];

          if (typeof layer._handleMousemove === 'function' && layer._hasInteractivity !== false) {
            layer._handleMousemove(latLng, function(result) {
              if (result) {
                var l = result.layer;

                hasData = true;

                if (l.options && l.options.tooltip) {
                  for (var i = 0; i < result.results.length; i++) {
                    var data = result.results[i],
                      tip;

                    if (typeof l.options.tooltip === 'function') {
                      tip = util.handlebars(l.options.tooltip(data));
                    } else if (typeof l.options.tooltip === 'string') {
                      tip = util.unescapeHtml(util.handlebars(l.options.tooltip, data));
                    }

                    if (tip) {
                      me._tooltips.push(tip);
                      activeTips.push(tip);
                    }
                  }
                }
              }
            });
          }
        }

        if (hasData) {
          me._setCursor('pointer');
        }

        if (me._tooltips.length) {
          tooltip.show(e.containerPoint, me._tooltips.join('<br>'));
        }
      }
    });
    me.on('mouseout', function() {
      tooltip.hide();
    });
  },
  _toLeaflet: function(config) {
    if (!config.div) {
      throw new Error('The map config object must have a div property');
    } else if (typeof config.div !== 'string' && typeof config.div !== 'object') {
      throw new Error('The map config object must be either a string or object');
    }

    if (config.baseLayers === false || (L.Util.isArray(config.baseLayers) && !config.baseLayers.length)) {
      config.baseLayers = [];
    } else {
      config.baseLayers = (function() {
        var visible = false;

        if (config.baseLayers && L.Util.isArray(config.baseLayers) && config.baseLayers.length) {
          for (var i = 0; i < config.baseLayers.length; i++) {
            var baseLayer = config.baseLayers[i];

            if (typeof baseLayer === 'string') {
              var name = baseLayer.split('-');

              if (name[1]) {
                baseLayer = baselayerPresets[name[0]][name[1]];
              } else {
                baseLayer = baselayerPresets[name];
              }
            }

            if (baseLayer.visible === true || typeof baseLayer.visible === 'undefined') {
              if (visible) {
                baseLayer.visible = false;
              } else {
                baseLayer.visible = true;
                visible = true;
              }
            } else {
              baseLayer.visible = false;
            }

            baseLayer.zIndex = 0;
            config.baseLayers[i] = baseLayer;
          }
        }

        if (visible) {
          return config.baseLayers;
        } else {
          var active = baselayerPresets.nps.lightStreets;
          active.visible = true;
          active.zIndex = 0;
          return [
            active
          ];
        }
      })();
    }

    config.center = (function() {
      var c = config.center;

      if (c) {
        return new L.LatLng(c.lat, c.lng);
      } else {
        return new L.LatLng(39, -96);
      }
    })();

    if (typeof config.div === 'string') {
      config.div = document.getElementById(config.div);
    }

    if (config.layers && L.Util.isArray(config.layers) && config.layers.length) {
      config.overlays = config.layers;

      for (var j = 0; j < config.overlays.length; j++) {
        var overlay = config.overlays[j];

        if (typeof overlay === 'string') {
          overlay = config.overlays[j] = overlayPresets[overlay];
        }
      }
    } else if (!config.overlays || !L.Util.isArray(config.overlays)) {
      config.overlays = [];
    }

    delete config.layers;
    config.zoom = typeof config.zoom === 'number' ? config.zoom : 4;
    return config;
  },
  closeModules: function() {
    var buttons = this._divModuleButtons.childNodes;

    this._buttonCloseModules.style.display = 'none';
    this._divWrapper.style.left = '0';
    this._divModules.style.display = 'none';

    for (var i = 1; i < buttons.length; i++) {
      var button = buttons[i];

      L.DomUtil.removeClass(button, 'active');
      button.style.display = 'inline-block';
    }

    this.invalidateSize();
  },
  showModule: function(title) {
    var divModules = this._divModules,
      childNodes = divModules.childNodes,
      modules = this.options.modules,
      i;

    title = title.replace(/_/g, ' ');

    for (i = 0; i < modules.length; i++) {
      var module = modules[i],
        visibility = 'none';

      if (module.title === title) {
        visibility = 'block';
      }

      module.visible = (visibility === 'block');
      childNodes[i].style.display = visibility;
    }

    divModules.style.display = 'block';
    this._divWrapper.style.left = '300px';
    this.invalidateSize();

    for (i = 0; i < this._divModuleButtons.childNodes.length; i++) {
      var button = this._divModuleButtons.childNodes[i];

      if (i === 0) {
        button.style.display = 'inline-block';
      } else {
        if (modules.length > 1) {
          button.style.display = 'inline-block';
        } else {
          button.style.display = 'none';
        }
      }

      if (button.id.replace('npmap-modules-buttons|', '').replace(/_/g, ' ') === title) {
        L.DomUtil.addClass(button, 'active');
      } else {
        L.DomUtil.removeClass(button, 'active');
      }
    }

    // TODO: Fire module 'show' event.
  },
  showModules: function() {
    var buttons = this._divModuleButtons.childNodes;

    this._buttonCloseModules.style.display = 'inline-block';
    this._divWrapper.style.left = '300px';
    this._divModules.style.display = 'block';

    for (var i = 1; i < buttons.length; i++) {
      buttons[i].style.display = 'inline-block';
    }

    this.invalidateSize();
  }
});

module.exports = function(config) {
  return new Map(config);
};
