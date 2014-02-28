/* global L */

'use strict';

var baselayerPresets = require('./preset/baselayers.json'),
  colorPresets = require('./preset/colors.json'),
  overlayPresets = require('./preset/overlays.json'),
  util = require('./util/util');

(function() {
  var style = colorPresets.gold;

  L.Circle.mergeOptions(style);
  L.CircleMarker.mergeOptions(style);
  L.Control.Attribution.mergeOptions({
    prefix: '<a href="http://www.nps.gov/npmap/disclaimer.html" target="_blank">Disclaimer</a>'
  });
  L.Polygon.mergeOptions(style);
  L.Polyline.mergeOptions({
    color: style.color,
    opacity: style.opacity,
    weight: style.weight
  });
  L.Popup.mergeOptions({
    autoPanPaddingBottomRight: [20, 20],
    autoPanPaddingTopLeft: [20, 20],
    maxHeight: 300,
    maxWidth: 221,
    minWidth: 221,
    offset: [1, -3]
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
})();

var Map = L.Map.extend({
  initialize: function(config) {
    var container = L.DomUtil.create('div', 'npmap-container'),
      map = L.DomUtil.create('div', 'npmap-map'),
      mapWrapper = L.DomUtil.create('div', 'npmap-map-wrapper'),
      me = this,
      modules = L.DomUtil.create('div', 'npmap-modules'),
      npmap = L.DomUtil.create('div', 'npmap' + (L.Browser.retina ? ' npmap-retina' : '')),
      toolbar = L.DomUtil.create('div', 'npmap-toolbar'),
      toolbarLeft = L.DomUtil.create('div', null),
      toolbarRight = L.DomUtil.create('div', null);

    config = me._toLeaflet(config);
    config.div.insertBefore(npmap, config.div.hasChildNodes() ? config.div.childNodes[0] : null);
    npmap.appendChild(modules);
    npmap.appendChild(container);
    toolbarLeft.style.cssText = 'float:left;';
    toolbarRight.style.cssText = 'float:right;';
    toolbar.appendChild(toolbarLeft);
    toolbar.appendChild(toolbarRight);
    container.appendChild(toolbar);
    container.appendChild(mapWrapper);
    mapWrapper.appendChild(map);
    config.div = map;
    config.zoomControl = false;
    L.Map.prototype.initialize.call(me, config.div, config);
    me._defaultCursor = me.getContainer().style.cursor;
    me._initializeModules();
    me._setupPopup();
    me._setupTooltip();
    me.on('autopanstart', function() {
      me._setCursor('default');
    });

    if (!me._loaded) {
      me.setView(config.center, config.zoom);
    }

    for (var i = 0; i < config.baseLayers.length; i++) {
      var baseLayer = config.baseLayers[i];

      baseLayer.zIndex = 0;

      if (baseLayer.visible === true) {
        if (baseLayer.type === 'arcgisserver') {
          baseLayer.L = L.npmap.layer[baseLayer.type][baseLayer.tiled === true ? 'tiled' : 'dynamic'](baseLayer);
        } else {
          baseLayer.L = L.npmap.layer[baseLayer.type](baseLayer);
        }

        me.addLayer(baseLayer.L);
        break;
      }
    }

    if (config.overlays.length) {
      var zIndex = 1;

      for (var j = 0; j < config.overlays.length; j++) {
        var overlay = config.overlays[j];

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

    return this;
  },
  _initializeModules: function() {
    if (this.options && this.options.modules && L.Util.isArray(this.options.modules)) {
      var initialize = null,
        me = this,
        modules = this.options.modules;

      this._divWrapper = this._container.parentNode;
      this._divModules = util.getChildElementsByClassName(this._divWrapper.parentNode.parentNode, 'npmap-modules')[0];
      this._divModuleButtons = L.DomUtil.create('div', 'npmap-modules-buttons', this._divWrapper);
      this._buttonCloseModules = L.DomUtil.create('button', 'npmap-modules-buttons-close', this._divModuleButtons);
      this._buttonCloseModules.title = 'Close';
      L.DomEvent.addListener(this._buttonCloseModules, 'click', me.closeModules, this);

      for (var i = 0; i < modules.length; i++) {
        var module = modules[i],
          title = module.title,
          button = L.DomUtil.create('button', 'npmap-modules-buttons-' + module.icon.toLowerCase(), this._divModuleButtons),
          div = L.DomUtil.create('div', 'module', this._divModules);

        button.id = 'npmap-modules-buttons|' + title.replace(/ /g, '_');
        button.title = title;
        div.id = 'npmap-module|' + title.replace(/ /g, '_');
        div.innerHTML = '<h3 class="title">' + title + '</h3><div class="content">' + module.content + '</div>';
        L.DomEvent.addListener(button, 'click', function() {
          me.showModule(this.id.replace('npmap-modules-buttons|', ''));
        });

        if (!initialize && module.visible === true) {
          initialize = module.title;
        }
      }

      if (initialize) {
        this.showModule(initialize);
      }
    }
  },
  _setCursor: function(type) {
    this._container.style.cursor = type;
  },
  _setupPopup: function() {
    var me = this;

    me.on('click', function(e) {
      var cancel = false,
        changed = false,
        queryable = [],
        layer;

      function mapChanged() {
        changed = true;
      }
      function mapClicked() {
        cancel = true;
      }

      me
        .on('click', mapClicked)
        .on('dragstart', mapChanged)
        .on('movestart', mapChanged)
        .on('zoomstart', mapChanged);

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
          interval;

        for (var i = 0; i < queryable.length; i++) {
          layer = queryable[i];

          if (layer.options && layer.options.type === 'arcgisserver') {
            me._setCursor('wait');
          }

          layer._handleClick(latLng, layer, function(l, data) {
            if (data) {
              var result = data;

              if (result) {
                var div;

                if (typeof result === 'string') {
                  div = document.createElement('div');
                  div.innerHTML = util.unescapeHtml(result);
                  results.push(div);
                } else if ('nodeType' in result) {
                  results.push(result);
                } else {
                  results.push(util.dataToHtml(l.options, data));
                }
              }
            }

            completed++;
          });
        }

        // TODO: Add support for a timeout so the infobox displays even if one or more operations fail.
        interval = setInterval(function() {
          intervals++;

          if (cancel) {
            clearInterval(interval);
            me
              .off('click', mapClicked)
              .off('dragstart', mapChanged)
              .off('movestart', mapChanged)
              .off('zoomstart', mapChanged);
          } else if (changed) {
            clearInterval(interval);
            me
              .off('click', mapClicked)
              .off('dragstart', mapChanged)
              .off('movestart', mapChanged)
              .off('zoomstart', mapChanged);
            me._setCursor('');
          } else if ((queryable.length === completed) || intervals === 50) {
            clearInterval(interval);
            me
              .off('click', mapClicked)
              .off('dragstart', mapChanged)
              .off('movestart', mapChanged)
              .off('zoomstart', mapChanged);

            if (intervals > 49) {
              // TODO: Show non-modal alert about the timeout.
            }

            if (results.length) {
              var div = L.DomUtil.create('div', null),
                popup = L.popup({
                  autoPanPaddingTopLeft: util._getAutoPanPaddingTopLeft(me.getContainer())
                });

              for (var i = 0; i < results.length; i++) {
                var result = results[i];

                if (typeof result === 'string') {
                  var divResult = document.createElement('div');
                  divResult.innerHTML = util.unescapeHtml(result);
                  div.appendChild(divResult);
                } else {
                  div.appendChild(result);
                }
              }

              popup.setContent(div).setLatLng(latLng).openOn(me);
            }

            me._setCursor('');
          }
        }, 100);
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
      var hasData = false,
        lastCursor = me.getContainer().style.cursor,
        latLng = e.latlng.wrap(),
        newActiveTips = [];

      tooltip.hide();
      
      if (lastCursor !== 'wait') {
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
          layer._handleMousemove(latLng, layer, function(l, data) {
            if (data) {
              var tip;

              hasData = true;

              if (typeof layer.options.tooltip === 'function') {
                tip = layer.options.tooltip(data);
              } else if (typeof layer.options.tooltip === 'string') {
                tip = util.unescapeHtml(util.handlebars(layer.options.tooltip, data));
              }

              if (tip) {
                me._tooltips.push(tip);
                activeTips.push(tip);
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
    });
  },
  _toLeaflet: function(config) {
    if (!config.div) {
      throw new Error('The map config object must have a div property');
    } else if (typeof config.div !== 'string' && typeof config.div !== 'object') {
      throw new Error('The map config object must be either a string or object');
    }

    if (typeof config.div === 'string') {
      config.div = document.getElementById(config.div);
    }

    if (config.layers && L.Util.isArray(config.layers) && config.layers.length) {
      config.overlays = config.layers;
    } else if (!config.overlays || !L.Util.isArray(config.overlays)) {
      config.overlays = [];
    }

    delete config.layers;

    if (config.baseLayers !== false) {
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

    if (config.overlays && L.Util.isArray(config.overlays) && config.overlays.length) {
      for (var j = 0; j < config.overlays.length; j++) {
        var overlay = config.overlays[j];

        if (typeof overlay === 'string') {
          overlay = config.overlays[j] = overlayPresets[overlay];
        }
      }
    }

    config.center = (function() {
      var c = config.center;

      if (c) {
        return new L.LatLng(c.lat, c.lng);
      } else {
        return new L.LatLng(39, -96);
      }
    })();
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

      button.style.display = 'inline-block';

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
