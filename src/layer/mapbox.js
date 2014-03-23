/* global document, L */
/* jslint node: true */

'use strict';

var reqwest = require('reqwest'),
  utfGrid = require('../util/utfgrid'),
  util = require('../util/util');

var MapBoxLayer = L.TileLayer.extend({
  options: {
    errorTileUrl: L.Util.emptyImageUrl,
    format: 'png',
    subdomains: [
      'a',
      'b',
      'c',
      'd'
    ]
  },
  statics: {
    FORMATS: [
      'jpg70',
      'jpg80',
      'jpg90',
      'png',
      'png32',
      'png64',
      'png128',
      'png256'
    ]
  },
  initialize: function(options) {
    var load;

    if (!options.id && !options.tileJson) {
      throw new Error('MapBox layers require either an "id" or "tileJson" property.');
    }

    if (options.format) {
      util.strictOneOf(options.format, MapBoxLayer.FORMATS);
    }

    if (L.Browser.retina && options.retinaVersion) {
      load = options.retinaVersion;
      options.detectRetina = true;
    } else {
      load = options.tileJson || options.id;

      // Retina is opt-in for now.
      if (!L.Browser.retina || !options.detectRetina) {
        options.detectRetina = false;
      }
    }

    L.Util.setOptions(this, options);
    L.TileLayer.prototype.initialize.call(this, undefined, options);
    this._hasInteractivity = false;
    this._loadTileJson(load);
  },
  getTileUrl: function(tilePoint) {
    var tiles = this.options.tiles,
      templated = L.Util.template(tiles[Math.floor(Math.abs(tilePoint.x + tilePoint.y) % tiles.length)], tilePoint);

    if (!templated) {
      return templated;
    } else {
      return templated.replace('.png', (this._autoScale() ? '@2x' : '') + '.' + this.options.format);
    }
  },
  onAdd: function onAdd(map) {
    this._map = map;
    L.TileLayer.prototype.onAdd.call(this, map);
  },
  onRemove: function onRemove() {
    L.TileLayer.prototype.onRemove.call(this, this._map);
  },
  _autoScale: function() {
    return L.Browser.retina && this.options.autoscale && this.options.detectRetina;
  },
  _getGridData: function(latLng, callback) {
    var me = this;

    this._grid.getTileGrid(this._getTileGridUrl(latLng), latLng, function(resultData, gridData) {
      if (gridData) {
        callback({
          layer: me,
          results: [
            gridData
          ]
        });
      } else {
        callback(null);
      }
    });
  },
  _getTileGridUrl: function(latLng) {
    var grids = this.options.grids,
      gridTileCoords = this._grid.getTileCoords(latLng);

    return L.Util.template(grids[Math.floor(Math.abs(gridTileCoords.x + gridTileCoords.y) % grids.length)], gridTileCoords);
  },
  _handleClick: function(latLng, callback) {
    this._getGridData(latLng, callback);
  },
  _handleMousemove: function (latLng, callback) {
    this._getGridData(latLng, callback);
  },
  _loadTileJson: function(from) {
    if (typeof from === 'string') {
      var me = this;

      if (from.indexOf('/') === -1) {
        from = (function(hash) {
          var urls = (function() {
            var endpoints = [
              'a.tiles.mapbox.com/v3/',
              'b.tiles.mapbox.com/v3/',
              'c.tiles.mapbox.com/v3/',
              'd.tiles.mapbox.com/v3/'
            ];

            for (var i = 0; i < endpoints.length; i++) {
              endpoints[i] = [document.location.protocol, '//', endpoints[i]].join('');
            }

            return endpoints;
          })();

          if (hash === undefined || typeof hash !== 'number') {
            return urls[0];
          } else {
            return urls[hash % urls.length];
          }
        })() + from + '.json';
      }

      reqwest({
        error: function(error) {
          me.fire('error', {
            error: error
          });
        },
        success: function(response) {
          if (response) {
            me._setTileJson(response);
            me.fire('ready');
          } else {
            me.fire('error', {
              error: 'Error'
            });
          }
        },
        type: 'jsonp',
        url: (function(url) {
          if ('https:' !== document.location.protocol) {
            return url;
          } else if (url.match(/(\?|&)secure/)) {
            return url;
          } else if (url.indexOf('?') !== -1) {
            return url + '&secure';
          } else {
            return url + '?secure';
          }
        })(from)
      });
    } else if (typeof _ === 'object') {
      this._setTileJson(from);
    }
  },
  _setTileJson: function(json) {
    var me = this,
      extend;

    util.strict(json, 'object');

    extend = {
      attribution: (function() {
        if (me.options.attribution) {
          return me.options.attribution;
        } else if (json.attribution) {
          return json.attribution;
        } else {
          return null;
        }
      })(),
      autoscale: json.autoscale || false,
      bounds: json.bounds ? this._toLeafletBounds(json.bounds) : null,
      grids: json.grids ? json.grids : null,
      maxZoom: json.maxzoom,
      minZoom: json.minzoom,
      tiles: json.tiles,
      tms: json.scheme === 'tms'
    };

    if (typeof this.options.attribution === 'undefined') {
      extend.attribution = json.attribution;
    }

    if (this.options.clickable !== false) {
      this._hasInteractivity = typeof json.grids === 'object';

      if (this._hasInteractivity) {
        this._grid = new utfGrid(this);
      }
    }

    if (typeof this.options.maxZoom === 'undefined') {
      extend.maxZoom = json.maxzoom;
    }

    if (typeof this.options.minZoom === 'undefined') {
      extend.minZoom = json.minzoom;
    }

    L.extend(this.options, extend);
    this.tileJson = json;
    this.redraw();
    return this;
  },
  _toLeafletBounds: function(_) {
    return new L.LatLngBounds([[_[1], _[0]], [_[3], _[2]]]);
  },
  _update: function() {
    if (this.options.tiles) {
      L.TileLayer.prototype._update.call(this);
    }
  }
});

module.exports = function(options) {
  return new MapBoxLayer(options);
};
