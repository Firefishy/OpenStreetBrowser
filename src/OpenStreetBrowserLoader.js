var OverpassLayer = require('overpass-layer')

const Repository = require('./Repository')

class OpenStreetBrowserLoader {
  constructor () {
    this.types = {}
    this.categories = {}
    this.repoCache = {}
    this.repositories = {}
    this.templates = {}
    this._loadClash = {} // if a category is being loaded multiple times, collect callbacks
  }

  setMap (map) {
    this.map = map
  }

  /**
   * @param string id ID of the category
   * @param [object] options Options.
   * @waram {boolean} [options.force=false] Whether repository should be reload or not.
   * @param function callback Callback which will be called with (err, category)
   */
  getCategory (id, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    var ids = this.getFullId(id, options)
    if (ids === null) {
      return callback(new Error('invalid id'), null)
    }

    if (options.force) {
      delete this.categories[ids.fullId]
    }

    if (ids.fullId in this.categories) {
      return callback(null, this.categories[ids.fullId])
    }

    var opt = JSON.parse(JSON.stringify(options))
    opt.categoryId = ids.entityId
    opt.repositoryId = ids.repositoryId

    this.getRepository(ids.repositoryId, opt, (err, repository) => {
      // maybe loaded in the meantime?
      if (ids.fullId in this.categories) {
        return callback(null, this.categories[ids.fullId])
      }

      if (err) {
        return callback(err, null)
      }

      repository.getCategory(ids.entityId, opt, (err, data) => {
        // maybe loaded in the meantime?
        if (ids.fullId in this.categories) {
          return callback(null, this.categories[ids.fullId])
        }

        if (err) { return callback(err) }

        this.getCategoryFromData(ids.id, opt, data, (err, category) =>{
          if (category) {
            category.setMap(this.map)
          }

          callback(err, category)
        })
      })
    })
  }

  /**
   * @param string repo ID of the repository
   * @param [object] options Options.
   * @param {boolean} [options.force=false] Whether repository should be reloaded or not.
   * @param function callback Callback which will be called with (err, repoData)
   */
  getRepo (repo, options, callback) {
    if (options.force) {
      delete this.repoCache[repo]
    }

    if (repo in this.repoCache) {
      return callback.apply(this, this.repoCache[repo])
    }

    if (repo in this._loadClash) {
      this._loadClash[repo].push(callback)
      return
    }

    this._loadClash[repo] = [ callback ]

    function reqListener (req) {
      if (req.status !== 200) {
        console.log('http error when loading repository', req)
        this.repoCache[repo] = [ req.statusText, null ]
      } else {
        try {
          let repoData = JSON.parse(req.responseText)
          this.repositories[repo] = new Repository(repo, repoData)
          this.repoCache[repo] = [ null,  repoData ]
        } catch (err) {
          console.log('couldn\'t parse repository', req.responseText)
          this.repoCache[repo] = [ 'couldn\t parse repository', null ]
        }
      }

      var todo = this._loadClash[repo]
      delete this._loadClash[repo]

      todo.forEach(function (callback) {
        callback.apply(this, this.repoCache[repo])
      }.bind(this))
    }

    var param = []
    if (repo) {
      param.push('repo=' + encodeURIComponent(repo))
    }
    param.push('lang=' + encodeURIComponent(ui_lang))
    param.push(config.categoriesRev)
    param = param.length ? '?' + param.join('&') : ''

    var req = new XMLHttpRequest()
    req.addEventListener('load', reqListener.bind(this, req))
    req.open('GET', 'repo.php' + param)
    req.send()
  }

  /**
   * @param string repo ID of the repository
   * @param [object] options Options.
   * @param {boolean} [options.force=false] Whether repository should be reloaded or not.
   * @param function callback Callback which will be called with (err, repository)
   */
  getRepository (id, options, callback) {
    if (id in this.repositories) {
      return callback(null, this.repositories[id])
    }

    this.getRepo(id, options, (err, repoData) => {
      if (err) {
        return callback(err)
      }

      callback(null, this.repositories[id])
    })
  }

  /**
   * @param string id ID of the template
   * @parapm [object] options Options.
   * @waram {boolean} [options.force=false] Whether repository should be reload or not.
   * @param function callback Callback which will be called with (err, template)
   */
  getTemplate (id, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    var ids = this.getFullId(id, options)

    if (options.force) {
      delete this.templates[ids.fullId]
    }

    if (ids.fullId in this.templates) {
      return callback(null, this.templates[ids.fullId])
    }

    var opt = JSON.parse(JSON.stringify(options))
    opt.templateId = ids.entityId
    opt.repositoryId = ids.repositoryId

    this.getRepository(ids.repositoryId, opt, (err, repository) => {
      // maybe loaded in the meantime?
      if (ids.fullId in this.templates) {
        return callback(null, this.templates[ids.fullId])
      }

      if (err) {
        return callback(err, null)
      }

      repository.getTemplate(ids.entityId, opt, (err, data) => {
        // maybe loaded in the meantime?
        if (ids.fullId in this.templates) {
          return callback(null, this.templates[ids.fullId])
        }

        if (err) { return callback(err) }

        this.templates[ids.fullId] = OverpassLayer.twig.twig({ data, autoescape: true })

        callback(null, this.templates[ids.fullId])
      })
    })
  }

  getCategoryFromData (id, options, data, callback) {
    var ids = this.getFullId(id, options)

    if (ids.fullId in this.categories) {
      return callback(null, this.categories[ids.fullId])
    }

    if (!data.type) {
      return callback(new Error('no type defined'), null)
    }

    if (!(data.type in this.types)) {
      return callback(new Error('unknown type'), null)
    }

    let repository = this.repositories[ids.repositoryId]

    var opt = JSON.parse(JSON.stringify(options))
    opt.id = ids.id
    var layer = new this.types[data.type](opt, data, repository)

    layer.setMap(this.map)

    this.categories[ids.fullId] = layer

    if ('load' in layer) {
      layer.load(function (err) {
        callback(err, layer)
      })
    } else {
      callback(null, layer)
    }
  }

  getFullId (id, options) {
    var result = {}

    if (!id) {
      return null
    }

    let m = id.match(/^(.*)\/([^/]*)/)
    if (m) {
      result.id = id
      result.repositoryId = m[1]
      result.entityId = m[2]
    } else if (options.repositoryId && options.repositoryId !== 'default') {
      result.repositoryId = options.repositoryId
      result.entityId = id
      result.id = result.repositoryId + '/' + id
    } else {
      result.id = id
      result.repositoryId = 'default'
      result.entityId = id
    }

    result.sublayerId = null
    m = result.entityId.split(/:/)
    if (m.length > 1) {
      result.sublayerId = m[0]
      result.entityId = m[1]
    }

    result.fullId = result.repositoryId + '/' + (result.sublayerId ? result.sublayerId + ':' : '') + result.entityId

    return result
  }

  forget (id) {
    var ids = this.getFullId(id, options)

    this.categories[ids.fullId].remove()
    delete this.categories[ids.fullId]
  }

  registerType (type, classObject) {
    this.types[type] = classObject
  }
}

module.exports = new OpenStreetBrowserLoader()
