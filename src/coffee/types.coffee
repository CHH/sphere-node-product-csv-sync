_ = require('underscore')._
Rest = require('sphere-node-connect').Rest

class Types
  constructor: ->
    @id2index = {}
    @name2id = {}
    @duplicateNames = []

  getAllProductTypes: (rest) ->
    deffered = Q.defer()
    rest.GET "/product-types?limit=0", (error, response, body) ->
      if error
        deferred.reject 'Error on getting product types: ' + error
      else if response.statusCode isnt 200
        deferred.reject "Problem on getting product types:\n" +
          "status #{response.statusCode})\n" +
          "body " + response.body
      else
        retailerProducts = JSON.parse(body).results
        deferred.resolve retailerProducts
    deffered.promise

  buildProductTypeMaps: (productTypes) ->
    for pt,index in productTypes
      name = pt.name
      id = pt.id
      @id2index[id] = index
      if _.has @name2id, name
        @duplicateNames.push name
      @name2id[name] = id


module.exports = Types
