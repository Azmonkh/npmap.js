/* global L */

'use strict';

var NavigationControl = L.Control.extend({
  options: {
    position: 'topleft'
  },
  onAdd: function(map) {
    var cls = 'npmap-control-navigation',
        container = L.DomUtil.create('div', 'leaflet-control ' + cls);

    this._map = map;
    this._zoomInButton = this._createButton('+', 'Zoom in', cls + '-in', container, this._zoomIn, this);
    this._zoomOutButton = this._createButton('-', 'Zoom out', cls + '-out', container, this._zoomOut, this);

    map.on('zoomend zoomlevelschange', this._updateDisabled, this);

    return container;
  },
  onRemove: function(map) {
    map.off('zoomend zoomlevelschange', this._updateDisabled, this);
  },
  _createButton: function(html, title, clsName, container, handler, context) {
    var button = L.DomUtil.create('button', clsName, container),
        stop = L.DomEvent.stopPropagation;

    button.innerHTML = html;
    button.title = title;

    L.DomEvent
      .on(button, 'click', stop)
      .on(button, 'mousedown', stop)
      .on(button, 'dblclick', stop)
      .on(button, 'click', L.DomEvent.preventDefault)
      .on(button, 'click', handler, context);

    return button;
  },
  _updateDisabled: function() {
    var clsName = 'leaflet-disabled',
        map = this._map;

    L.DomUtil.removeClass(this._zoomInButton, clsName);
    L.DomUtil.removeClass(this._zoomOutButton, clsName);

    if (map._zoom === map.getMinZoom()) {
      L.DomUtil.addClass(this._zoomOutButton, clsName);
    }
    if (map._zoom === map.getMaxZoom()) {
      L.DomUtil.addClass(this._zoomInButton, clsName);
    }
  },
  _zoomIn: function(e) {

  },
  _zoomOut: function(e) {

  }
});

L.Map.mergeOptions({
  navigationControl: true
});
L.Map.addInitHook(function() {
  if (this.options.navigationControl) {
    this.zoomControl = new L.npmap.control.navigation();
    this.addControl(this.zoomControl);
  }
});

module.exports = function(options) {
  return new NavigationControl(options);
};