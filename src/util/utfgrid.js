var reqwest = require('reqwest'),
  tileMath = require('../util/tilemath');

module.exports = function(layer) {
  var cache = {};

  return {
    getTileCoords: function(latLng) {
      var zoom = layer._map.getZoom();

      return {
        x: tileMath.long2tile(latLng.lng, zoom),
        y: tileMath.lat2tile(latLng.lat, zoom),
        z: zoom
      };
    },
    getTileGrid: function (url, latLng, callback) {
      if (cache[url]) {
        var response = cache[url];

        if (response === 'empty' || response === 'loading') {
          callback(null, null);
        } else {
          callback(response, this.getTileGridPoint(latLng, response));
        }
      } else {
        var me = this;

        cache[url] = 'loading';

        reqwest({
          error: function() {
            cache[url] = 'empty';
            callback(null, null);
          },
          success: function(response) {
            if (response) {
              cache[url] = response;
              callback(response, me.getTileGridPoint(latLng, response));
            } else {
              cache[url] = 'empty';
              callback(null, null);
            }
          },
          timeout: 2000,
          type: 'jsonp',
          url: url
        });
      }
    },
    getTileGridPoint: function(latLng, response) {
      var map = layer._map,
        point = map.project(latLng.wrap()),
        resolution = 4,
        tileSize = 256,
        max = map.options.crs.scale(map.getZoom()) / tileSize,
        x = Math.floor(point.x / tileSize),
        y = Math.floor(point.y / tileSize);

      x = (x + max) % max;
      y = (y + max) % max;

      return (response.data[response.keys[this.utfDecode(response.grid[Math.floor((point.y - (y * tileSize)) / resolution)].charCodeAt(Math.floor((point.x - (x * tileSize)) / resolution)))]]);
    },
    hasUtfData: function(url, latLng) {
      var cache = reqwest.getCache(url),
        returnValue = {'cursor': 'default'};

      if (cache) {
        if (cache.cacheStatus === 'success' && cache.response) {
          returnValue = this.getTileGridPoint(latLng, cache.response) ? {'cursor': 'pointer'} : false;
        } else if (cache.cacheStatus === 'error') {
          returnValue = false;
        }
      }

      return returnValue;
    },
    utfDecode: function(key) {
      if (key >= 93) {
        key--;
      }

      if (key >= 35) {
        key--;
      }

      return key - 32;
    }
  };
};
