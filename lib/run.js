/* ===========================================================
# sphere-node-product-csv-sync - v0.5.7
# ==============================================================
# Copyright (c) 2014 Hajo Eichler
# Licensed under the MIT license.
*/
var CONS, Csv, Exporter, GLOBALS, Importer, ProjectCredentialsConfig, Promise, fs, package_json, program, prompt, _;

_ = require('underscore');

program = require('commander');

prompt = require('prompt');

Csv = require('csv');

Promise = require('bluebird');

fs = Promise.promisifyAll(require('fs'));

ProjectCredentialsConfig = require('sphere-node-utils').ProjectCredentialsConfig;

Importer = require('./import');

Exporter = require('./export');

CONS = require('./constants');

GLOBALS = require('./globals');

package_json = require('../package.json');

module.exports = (function() {
  function _Class() {}

  _Class._list = function(val) {
    return _.map(val.split(','), function(v) {
      return v.trim();
    });
  };

  _Class._getFilterFunction = function(opts) {
    return new Promise(function(resolve, reject) {
      var f;
      if (opts.csv) {
        return fs.readFileAsync(opts.csv, 'utf8')["catch"](function(err) {
          console.error("Problems on reading identity file '" + opts.csv + "': " + err);
          return process.exit(2);
        }).then(function(content) {
          return Csv().from.string(content).to.array(function(data, count) {
            var f, identHeader, productIds, skus;
            identHeader = data[0][0];
            if (identHeader === CONS.HEADER_ID) {
              productIds = _.flatten(_.rest(data));
              f = function(product) {
                return _.contains(productIds, product.id);
              };
              return resolve(f);
            } else if (identHeader === CONS.HEADER_SKU) {
              skus = _.flatten(_.rest(data));
              f = function(product) {
                var v, variants;
                product.variants || (product.variants = []);
                variants = [product.masterVariant].concat(product.variants);
                v = _.find(variants, function(variant) {
                  return _.contains(skus, variant.sku);
                });
                return v != null;
              };
              return resolve(f);
            } else {
              return reject("CSV does not fit! You only need one column - either '" + CONS.HEADER_ID + "' or '" + CONS.HEADER_SKU + "'.");
            }
          });
        });
      } else {
        f = function(product) {
          return true;
        };
        return resolve(f);
      }
    });
  };

  _Class.run = function(argv) {
    var _subCommandHelp;
    _subCommandHelp = function(cmd) {
      program.emit(cmd, null, ['--help']);
      return process.exit(1);
    };
    program.version(package_json.version).usage('[globals] [sub-command] [options]').option('-p, --projectKey <key>', 'your SPHERE.IO project-key').option('-i, --clientId <id>', 'your OAuth client id for the SPHERE.IO API').option('-s, --clientSecret <secret>', 'your OAuth client secret for the SPHERE.IO API').option('--sphereHost <host>', 'SPHERE.IO API host to connect to').option('--sphereAuthHost <host>', 'SPHERE.IO OAuth host to connect to').option('--timeout [millis]', 'Set timeout for requests (default is 300000)', parseInt, 300000).option('--verbose', 'give more feedback during action').option('--debug', 'give as many feedback as possible');
    program.command('import').description('Import your products from CSV into your SPHERE.IO project.').option('-c, --csv <file>', 'CSV file containing products to import').option('-l, --language [lang]', 'Default language to using during import (for slug generation, category linking etc. - default is en)', 'en').option('--csvDelimiter [delim]', 'CSV Delimiter that separates the cells (default is comma - ",")', ',').option('--multiValueDelimiter [delim]', 'Delimiter to separate values inside of a cell (default is semicolon - ";")', ';').option('--customAttributesForCreationOnly <items>', 'List of comma-separated attributes to use when creating products (ignore when updating)', this._list).option('--continueOnProblems', 'When a product does not validate on the server side (400er response), ignore it and continue with the next products').option('--suppressMissingHeaderWarning', 'Do not show which headers are missing per produt type.').option('--allowRemovalOfVariants', 'If given variants will be removed if there is no corresponding row in the CSV. Otherwise they are not touched.').option('--ignoreSeoAttributes', 'If true all meta* attrbutes are kept untouched.').option('--publish', 'When given, all changes will be published immediately').option('--updatesOnly', "Won't create any new products, only updates existing").option('--dryRun', 'Will list all action that would be triggered, but will not POST them to SPHERE.IO').usage('--projectKey <project-key> --clientId <client-id> --clientSecret <client-secret> --csv <file>').action(function(opts) {
      var _ref;
      GLOBALS.DEFAULT_LANGUAGE = opts.language;
      GLOBALS.DELIM_MULTI_VALUE = (_ref = opts.multiValueDelimiter) != null ? _ref : GLOBALS.DELIM_MULTI_VALUE;
      if (!program.projectKey) {
        return _subCommandHelp('import');
      }
      return ProjectCredentialsConfig.create().then(function(credentials) {
        var importer, options;
        options = {
          config: credentials.enrichCredentials({
            project_key: program.projectKey,
            client_id: program.clientId,
            client_secret: program.clientSecret
          }),
          timeout: program.timeout,
          show_progress: true,
          user_agent: "" + package_json.name + " - Import - " + package_json.version,
          csvDelimiter: opts.csvDelimiter
        };
        if (program.sphereHost) {
          options.host = program.sphereHost;
        }
        if (program.sphereAuthHost) {
          options.oauth_host = program.sphereAuthHost;
          options.rejectUnauthorized = false;
        }
        options.continueOnProblems = opts.continueOnProblems || false;
        importer = new Importer(options);
        importer.blackListedCustomAttributesForUpdate = opts.customAttributesForCreationOnly || [];
        importer.validator.suppressMissingHeaderWarning = opts.suppressMissingHeaderWarning;
        importer.allowRemovalOfVariants = opts.allowRemovalOfVariants;
        if (opts.ignoreSeoAttributes) {
          importer.syncSeoAttributes = false;
        }
        importer.publishProducts = opts.publish;
        if (opts.updatesOnly) {
          importer.updatesOnly = true;
        }
        if (opts.dryRun) {
          importer.dryRun = true;
        }
        return fs.readFileAsync(opts.csv, 'utf8').then(function(content) {
          return importer["import"](content).then(function(result) {
            console.log(result);
            return process.exit(0);
          })["catch"](function(err) {
            console.error(err);
            return process.exit(1);
          });
        })["catch"](function(err) {
          console.error("Problems on reading file '" + opts.csv + "': " + err);
          return process.exit(2);
        });
      })["catch"](function(err) {
        console.error("Problems on getting client credentials from config files: " + err);
        return _subCommandHelp('import');
      }).done();
    });
    program.command('state').description('Allows to publish, unpublish or delete (all) products of your SPHERE.IO project.').option('--changeTo <publish,unpublish,delete>', 'publish unpublished products / unpublish published products / delete unpublished products').option('--csv <file>', 'processes products defined in a CSV file by either "sku" or "id". Otherwise all products are processed.').option('--continueOnProblems', 'When a there is a problem on changing a product\'s state (400er response), ignore it and continue with the next products').option('--forceDelete', 'whether to force deletion without asking for confirmation', false).usage('--projectKey <project-key> --clientId <client-id> --clientSecret <client-secret> --changeTo <state>').action((function(_this) {
      return function(opts) {
        if (!program.projectKey) {
          return _subCommandHelp('state');
        }
        return ProjectCredentialsConfig.create().then(function(credentials) {
          var options, property, publish, remove, run;
          options = {
            config: credentials.enrichCredentials({
              project_key: program.projectKey,
              client_id: program.clientId,
              client_secret: program.clientSecret
            }),
            timeout: program.timeout,
            show_progress: true,
            user_agent: "" + package_json.name + " - State - " + package_json.version
          };
          if (program.sphereHost) {
            options.host = program.sphereHost;
          }
          if (program.sphereAuthHost) {
            options.oauth_host = program.sphereAuthHost;
            options.rejectUnauthorized = false;
          }
          if (program.sphereHost) {
            options.host = program.sphereHost;
          }
          remove = opts.changeTo === 'delete';
          publish = (function() {
            switch (opts.changeTo) {
              case 'publish':
              case 'delete':
                return true;
              case 'unpublish':
                return false;
              default:
                console.error("Unknown argument '" + opts.changeTo + "' for option changeTo!");
                return process.exit(3);
            }
          })();
          run = function() {
            return _this._getFilterFunction(opts).then(function(filterFunction) {
              var importer;
              importer = new Importer(options);
              importer.continueOnProblems = opts.continueOnProblems;
              return importer.changeState(publish, remove, filterFunction);
            }).then(function(result) {
              console.log(result);
              return process.exit(0);
            })["catch"](function(err) {
              console.error(err);
              return process.exit(1);
            }).done();
          };
          if (remove) {
            if (opts.forceDelete) {
              return run(options);
            } else {
              prompt.start();
              property = {
                name: 'ask',
                message: 'Do you really want to delete products?',
                validator: /y[es]*|n[o]?/,
                warning: 'Please answer with yes or no',
                "default": 'no'
              };
              return prompt.get(property, function(err, result) {
                if (_.isString(result.ask) && result.ask.match(/y(es){0,1}/i)) {
                  return run(options);
                } else {
                  console.error('Aborted.');
                  return process.exit(9);
                }
              });
            }
          } else {
            return run(options);
          }
        })["catch"](function(err) {
          console.error("Problems on getting client credentials from config files: " + err);
          return _subCommandHelp('state');
        }).done();
      };
    })(this));
    program.command('export').description('Export your products from your SPHERE.IO project to CSV using.').option('-t, --template <file>', 'CSV file containing your header that defines what you want to export').option('-o, --out <file>', 'Path to the file the exporter will write the resulting CSV in').option('-j, --json <file>', 'Path to the JSON file the exporter will write the resulting products').option('-q, --queryString <query>', 'Query string to specify the sub-set of products to export').option('-l, --language [lang]', 'Language used on export for category names (default is en)', 'en').option('--queryType <type>', 'Whether to do a query or a search request', 'query').option('--queryEncoded', 'Whether the given query string is already encoded or not', false).usage('--projectKey <project-key> --clientId <client-id> --clientSecret <client-secret> --template <file> --out <file>').action(function(opts) {
      GLOBALS.DEFAULT_LANGUAGE = opts.language;
      if (!program.projectKey) {
        return _subCommandHelp('export');
      }
      return ProjectCredentialsConfig.create().then(function(credentials) {
        var exporter, options;
        options = {
          client: {
            config: credentials.enrichCredentials({
              project_key: program.projectKey,
              client_id: program.clientId,
              client_secret: program.clientSecret
            }),
            timeout: program.timeout,
            user_agent: "" + package_json.name + " - Export - " + package_json.version
          },
          "export": {
            show_progress: true,
            queryString: opts.queryString,
            queryType: opts.queryType,
            isQueryEncoded: opts.queryEncoded || false
          }
        };
        if (program.sphereHost) {
          options.client.host = program.sphereHost;
        }
        if (program.sphereAuthHost) {
          options.client.oauth_host = program.sphereAuthHost;
          options.client.rejectUnauthorized = false;
        }
        exporter = new Exporter(options);
        if (opts.json) {
          return exporter.exportAsJson(opts.json).then(function(result) {
            console.log(result);
            return process.exit(0);
          })["catch"](function(err) {
            console.error(err);
            return process.exit(1);
          }).done();
        } else {
          return fs.readFileAsync(opts.template, 'utf8').then(function(content) {
            return exporter["export"](content, opts.out).then(function(result) {
              console.log(result);
              return process.exit(0);
            })["catch"](function(err) {
              console.error(err);
              return process.exit(1);
            });
          })["catch"](function(err) {
            console.error("Problems on reading template file '" + opts.template + "': " + err);
            return process.exit(2);
          });
        }
      })["catch"](function(err) {
        console.error("Problems on getting client credentials from config files: " + err);
        return _subCommandHelp('export');
      }).done();
    });
    program.command('template').description('Create a template for a product type of your SPHERE.IO project.').option('-o, --out <file>', 'Path to the file the exporter will write the resulting CSV in').option('-l, --languages [lang,lang]', 'List of languages to use for template (default is [en])', this._list, ['en']).option('--all', 'Generates one template for all product types - if not given you will be ask which product type to use').usage('--projectKey <project-key> --clientId <client-id> --clientSecret <client-secret> --out <file>').action(function(opts) {
      if (!program.projectKey) {
        return _subCommandHelp('template');
      }
      return ProjectCredentialsConfig.create().then(function(credentials) {
        var exporter, options;
        options = {
          client: {
            config: credentials.enrichCredentials({
              project_key: program.projectKey,
              client_id: program.clientId,
              client_secret: program.clientSecret
            })
          },
          timeout: program.timeout,
          show_progress: true,
          user_agent: "" + package_json.name + " - Template - " + package_json.version
        };
        if (program.sphereHost) {
          options.client.host = program.sphereHost;
        }
        if (program.sphereAuthHost) {
          options.client.oauth_host = program.sphereAuthHost;
          options.client.rejectUnauthorized = false;
        }
        exporter = new Exporter(options);
        return exporter.createTemplate(opts.languages, opts.out, opts.all).then(function(result) {
          console.log(result);
          return process.exit(0);
        })["catch"](function(err) {
          console.error(err);
          return process.exit(1);
        });
      })["catch"](function(err) {
        console.error("Problems on getting client credentials from config files: " + err);
        return _subCommandHelp('template');
      }).done();
    });
    program.parse(argv);
    if (program.args.length === 0) {
      return program.help();
    }
  };

  return _Class;

})();

module.exports.run(process.argv);
