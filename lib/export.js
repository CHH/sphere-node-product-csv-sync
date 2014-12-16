/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var Categories, Channels, Csv, CustomerGroups, Export, ExportMapping, Header, Promise, SphereClient, Taxes, Types, fs, prompt, _;

_ = require('underscore');

Csv = require('csv');

Promise = require('bluebird');

fs = Promise.promisifyAll(require('fs'));

prompt = Promise.promisifyAll(require('prompt'));

SphereClient = require('sphere-node-sdk').SphereClient;

Types = require('./types');

Categories = require('./categories');

Channels = require('./channels');

CustomerGroups = require('./customergroups');

Header = require('./header');

Taxes = require('./taxes');

ExportMapping = require('./exportmapping');

Export = (function() {
  function Export(options) {
    var _ref, _ref1, _ref2, _ref3;
    if (options == null) {
      options = {};
    }
    this.queryOptions = {
      queryString: (_ref = options["export"]) != null ? (_ref1 = _ref.queryString) != null ? _ref1.trim() : void 0 : void 0,
      queryType: (_ref2 = options["export"]) != null ? _ref2.queryType : void 0,
      isQueryEncoded: (_ref3 = options["export"]) != null ? _ref3.isQueryEncoded : void 0
    };
    this.client = new SphereClient(options.client);
    this.typesService = new Types();
    this.categoryService = new Categories();
    this.channelService = new Channels();
    this.customerGroupService = new CustomerGroups();
    this.taxService = new Taxes();
  }

  Export.prototype._initMapping = function(header) {
    var options;
    options = {
      channelService: this.channelService,
      categoryService: this.categoryService,
      typesService: this.typesService,
      customerGroupService: this.customerGroupService,
      taxService: this.taxService,
      header: header
    };
    return new ExportMapping(options);
  };

  Export.prototype._getProductService = function(staged) {
    var productsService;
    if (staged == null) {
      staged = true;
    }
    productsService = this.client.productProjections;
    if (this.queryOptions.queryString) {
      productsService.byQueryString(this.queryOptions.queryString, this.queryOptions.isQueryEncoded);
      if (this.queryOptions.queryType === 'search') {
        return productsService.search();
      } else {
        return productsService.fetch();
      }
    } else {
      return productsService.all().staged(staged).fetch();
    }
  };

  Export.prototype["export"] = function(templateContent, outputFile, staged) {
    if (staged == null) {
      staged = true;
    }
    return this._parse(templateContent).then((function(_this) {
      return function(header) {
        var data, errors, exportMapping;
        errors = header.validate();
        if (_.size(errors) !== 0) {
          return Promise.reject(errors);
        } else {
          header.toIndex();
          header.toLanguageIndex();
          exportMapping = _this._initMapping(header);
          data = [_this.typesService.getAll(_this.client), _this.categoryService.getAll(_this.client), _this.channelService.getAll(_this.client), _this.customerGroupService.getAll(_this.client), _this.taxService.getAll(_this.client), _this._getProductService(staged)];
          return Promise.all(data).then(function(_arg) {
            var categories, channels, csv, customerGroups, product, productType, productTypes, products, taxes, _i, _j, _len, _len1, _ref, _ref1;
            productTypes = _arg[0], categories = _arg[1], channels = _arg[2], customerGroups = _arg[3], taxes = _arg[4], products = _arg[5];
            console.log("Number of product types: " + productTypes.body.total + ".");
            if (products.body.total === 0) {
              return Promise.resolve('No products found.');
            } else {
              console.log("Number of fetched products: " + products.body.count + "/" + products.body.total + ".");
              _this.typesService.buildMaps(productTypes.body.results);
              _this.categoryService.buildMaps(categories.body.results);
              _this.channelService.buildMaps(channels.body.results);
              _this.customerGroupService.buildMaps(customerGroups.body.results);
              _this.taxService.buildMaps(taxes.body.results);
              _ref = productTypes.body.results;
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                productType = _ref[_i];
                header._productTypeLanguageIndexes(productType);
              }
              csv = [header.rawHeader];
              _ref1 = products.body.results;
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                product = _ref1[_j];
                csv = csv.concat(exportMapping.mapProduct(product, productTypes.body.results));
              }
              return _this._saveCSV(outputFile, csv).then(function() {
                return Promise.resolve('Export done.');
              });
            }
          });
        }
      };
    })(this));
  };

  Export.prototype.exportAsJson = function(outputFile) {
    return this._getProductService().then((function(_this) {
      return function(result) {
        var products;
        products = result.body.results;
        if (_.size(products) === 0) {
          return Promise.resolve('No products found.');
        } else {
          console.log("Number of fetched products: " + result.body.count + "/" + result.body.total + ".");
          return _this._saveJSON(outputFile, products).then(function() {
            return Promise.resolve('Export done.');
          });
        }
      };
    })(this));
  };

  Export.prototype.createTemplate = function(languages, outputFile, allProductTypes) {
    if (allProductTypes == null) {
      allProductTypes = false;
    }
    return this.typesService.getAll(this.client).then((function(_this) {
      return function(result) {
        var allHeaders, csv, exportMapping, idsAndNames, productTypes, property;
        productTypes = result.body.results;
        if (_.size(productTypes) === 0) {
          return Promise.reject('Can not find any product type.');
        } else {
          idsAndNames = _.map(productTypes, function(productType) {
            return productType.name;
          });
          if (allProductTypes) {
            allHeaders = [];
            exportMapping = new ExportMapping();
            _.each(productTypes, function(productType) {
              return allHeaders = allHeaders.concat(exportMapping.createTemplate(productType, languages));
            });
            csv = _.uniq(allHeaders);
            return _this._saveCSV(outputFile, [csv]).then(function() {
              return Promise.resolve('Template for all product types generated.');
            });
          } else {
            _.each(idsAndNames, function(entry, index) {
              return console.log('  %d) %s', index, entry);
            });
            prompt.start();
            property = {
              name: 'number',
              message: 'Enter the number of the producttype.',
              validator: /\d+/,
              warning: 'Please enter a valid number'
            };
            return prompt.getAsync(property).then(function(result) {
              var productType;
              productType = productTypes[parseInt(result.number)];
              if (productType) {
                console.log("Generating template for product type '" + productType.name + "' (id: " + productType.id + ").");
                process.stdin.destroy();
                csv = new ExportMapping().createTemplate(productType, languages);
                return _this._saveCSV(outputFile, [csv]).then(function() {
                  return Promise.resolve('Template generated.');
                });
              } else {
                return Promise.reject('Please re-run and select a valid number.');
              }
            });
          }
        }
      };
    })(this));
  };

  Export.prototype._saveCSV = function(file, content) {
    return new Promise(function(resolve, reject) {
      return Csv().from(content).to.path(file, {
        encoding: 'utf8'
      }).on('error', function(err) {
        return reject(err);
      }).on('close', function(count) {
        return resolve(count);
      });
    });
  };

  Export.prototype._saveJSON = function(file, content) {
    return fs.writeFileAsync(file, JSON.stringify(content, null, 2), {
      encoding: 'utf8'
    });
  };

  Export.prototype._parse = function(csvString) {
    return new Promise(function(resolve, reject) {
      return Csv().from.string(csvString).to.array(function(data, count) {
        var header;
        header = new Header(data[0]);
        return resolve(header);
      }).on('error', function(err) {
        return reject(err);
      });
    });
  };

  return Export;

})();

module.exports = Export;
