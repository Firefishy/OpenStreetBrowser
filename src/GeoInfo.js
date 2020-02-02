const tabs = require('modulekit-tabs')

function formatCoord (coord) {
  return coord.lat.toFixed(5) + ' ' + coord.lng.toFixed(5)
}

register_hook('init', function () {
  let tab = new tabs.Tab({
    id: 'search',
    weight: -1
  })
  tab.content.classList.add('geo-info')
  global.tabs.add(tab)

  updateTabHeader(tab.header)
  tab.header.title = lang('geo-info')

  let domBBoxNW = document.createElement('div')
  tab.content.appendChild(domBBoxNW)

  let domCenter = document.createElement('div')
  tab.content.appendChild(domCenter)

  let domBBoxSE = document.createElement('div')
  tab.content.appendChild(domBBoxSE)

  let domMouse = document.createElement('div')
  tab.content.appendChild(domMouse)

  let domLocation = document.createElement('div')
  tab.content.appendChild(domLocation)

  global.map.on('move', () => {
    let bounds = map.getBounds()
    domBBoxNW.innerHTML = '▛ ' + formatCoord(bounds.getNorthWest().wrap())
    domCenter.innerHTML = '<i class="fas fa-crosshairs"></i> ' + formatCoord(bounds.getCenter().wrap())
    domBBoxSE.innerHTML = '▟ ' + formatCoord(bounds.getSouthEast().wrap())
    updateTabHeader(tab.header)
  })

  global.map.on('mousemove', (e) => {
    domMouse.innerHTML = '<i class="fas fa-mouse-pointer"></i> ' + formatCoord(e.latlng.wrap())
  })

  global.map.on('mouseout', (e) => {
    domMouse.innerHTML = ''
  })

  global.map.on('locationfound', (e) => {
    domLocation.innerHTML = '<i class="fas fa-map-marker-alt"></i> ' + formatCoord(e.latlng.wrap())
  })
})

function updateTabHeader (header) {
  if (!global.map._loaded) {
    return
  }

  let center = global.map.getCenter().wrap()
  if (center.lng < -35) {
    header.innerHTML = '<i class="fas fa-globe-americas"></i>'
  } else if (center.lng > 80) {
    header.innerHTML = '<i class="fas fa-globe-asia"></i>'
  } else if (center.lat < 30) {
    header.innerHTML = '<i class="fas fa-globe-africa"></i>'
  } else {
    header.innerHTML = '<i class="fas fa-globe-europe"></i>'
  }
}
