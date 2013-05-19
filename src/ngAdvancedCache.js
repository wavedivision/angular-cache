/**
 * @author Jason Dobry <jason.dobry@gmail.com>
 * @file ngAdvancedCache-<%= pkg.version %>.js
 * @version <%= pkg.version %>
 * @copyright (c) 2013 Jason Dobry <http://jmdobry.github.io/ngAdvancedCache>
 * @license MIT <https://github.com/jmdobry/ngAdvancedCache/blob/master/LICENSE>
 *
 * @overview ngAdvancedCache is a caching system that improves upon the capabilities of the
 * $cacheFactory provided by AngularJS.
 */
(function (window, angular, undefined) {
    'use strict';

    /**
     * @module ngAdvancedCache
     * @desc Provides an $AdvancedCacheFactoryProvider, which gives you the ability to use an
     *       $advancedCacheFactory. The $advancedCacheFactory produces AdvancedCache objects, which
     *       the same abilities as the cache objects that come with Angular, except with some added
     *       functionality.
     *
     * @example
    angular.module('myApp', ['ngAdvancedCache']);

    angular.module('myApp').service('myService', ['$advancedCacheFactory',
        function ($advancedCacheFactory) {
            // create a cache with default settings
            var myCache = $advancedCacheFactory('myCache');

            // create an LRU cache with a capacity of 10
            var myLRUCache = $advancedCacheFactory('myLRUCache', {
                capacity: 10
            });

            // create a cache whose items have a default maximum lifetime of 10 minutes
            var myTimeLimitedCache = $advancedCacheFactory('myTimeLimitedCache', {
                maxAge: 600000
            });
        }
    ]);
     */
    angular.module('ngAdvancedCache', []);

    /**
     * @class $AdvancedCacheFactoryProvider
     * @desc Provider for the $advancedCacheFactory.
     * @see {@link http://docs.angularjs.org/api/ng.$cacheFactory|ng.$cacheFactory}
     *
     * @example
    angular.module('myApp').service('myService', ['$advancedCacheFactory',
        function ($advancedCacheFactory) {
            // create a cache with default settings
            var myCache = $advancedCacheFactory('myCache');

            // create an LRU cache with a capacity of 10
            var myLRUCache = $advancedCacheFactory('myLRUCache', {
                capacity: 10
            });

            // create a cache whose items have a default maximum lifetime of 10 minutes
            var myTimeLimitedCache = $advancedCacheFactory('myTimeLimitedCache', {
                maxAge: 600000
            });
        }
    ]);
     */
    function $AdvancedCacheFactoryProvider() {

        /** @private= */
        this.$get = function () {
            var caches = {};

            /**
             * @class AdvancedCache
             * @desc Instantiated via <code>$advancedCacheFactory()</code>
             * @param {string} cacheId The id of the new cache.
             * @param {object} [options] { capacity: {number}, maxAge: {number} }
             *
             * @example
             angular.module('myModule').service('myService', ['$advancedCacheFactory', function ($advancedCacheFactory) {

                // create a cache with default settings
                var myCache = $advancedCacheFactory('myCache');

                // create an LRU cache with a capacity of 10
                var myLRUCache = $advancedCacheFactory('myLRUCache', { capacity: 10 });

                // create a cache whose items have a default maximum lifetime of 10 minutes
                var myTimeLimitedCache = $advancedCacheFactory('myTimeLimitedCache', { maxAge: 600000 });
            });
             */
            function AdvancedCache(cacheId, options) {
                var size = 0,
                    stats = angular.extend({}, options, {id: cacheId}),
                    data = {},
                    capacity = (options && options.capacity) || Number.MAX_VALUE,
                    maxAge = (options && options.maxAge) || null,
                    lruHash = {},
                    freshEnd = null,
                    staleEnd = null;

                /**
                 * @method isExpired
                 * @desc Returns true if the entry has been in the cache longer than its max age.
                 * @param {object} lruEntry The cache entry to be examined.
                 * @returns {boolean} true if the entry has been in the cache longer than its
                 *          maxAge, false if not or maxAge is null
                 * @private
                 */
                function _isExpired(lruEntry) {
                    var entryMaxAge;

                    if ((lruEntry.maxAge || maxAge)) {
                        entryMaxAge = lruEntry.maxAge ? lruEntry.maxAge
                            : maxAge ? maxAge
                            : null;
                    }

                    if (entryMaxAge) {
                        return new Date().getTime() - lruEntry.timestamp > entryMaxAge;
                    }
                    return false;
                }

                /**
                 * @method refresh
                 * @desc Makes the `entry` the freshEnd of the LRU linked list.
                 * @param {object} entry
                 * @private
                 */
                function _refresh(entry) {
                    if (entry !== freshEnd) {
                        if (!staleEnd) {
                            staleEnd = entry;
                        } else if (staleEnd === entry) {
                            staleEnd = entry.n;
                        }

                        _link(entry.n, entry.p);
                        _link(entry, freshEnd);
                        freshEnd = entry;
                        freshEnd.n = null;
                    }
                }

                /**
                 * @method link
                 * @desc Bidirectionally links two entries of the LRU linked list
                 * @param {object} nextEntry
                 * @param {object} prevEntry
                 * @private
                 */
                function _link(nextEntry, prevEntry) {
                    if (nextEntry !== prevEntry) {
                        if (nextEntry) {
                            nextEntry.p = prevEntry; //p stands for previous, 'prev' didn't minify
                        }
                        if (prevEntry) {
                            prevEntry.n = nextEntry; //n stands for next, 'next' didn't minify
                        }
                    }
                }

                /**
                 * @method AdvancedCache.put
                 * @desc Add a key-value pair with timestamp to the cache.
                 * @param {string} key The identifier for the item to add to the cache.
                 * @param {*} value The value of the item to add to the cache.
                 * @param {object} [options] { maxAge: {number} }
                 * @returns {*} value The value of the item added to the cache.
                 * @public
                 *
                 * @example
                 angular.module('myModule').service('myService', ['$advancedCacheFactory', function ($advancedCacheFactory) {

                    // create a cache with default settings
                    var myCache = $advancedCacheFactory('myCache');

                    // add an item to the cache with a maximum lifetime of 10 seconds.
                    myCache.put('someItem', {
                        name: 'John Doe',
                        role: 'Manager'
                    }, { maxAge: 10000 });
                });
                 */
                this.put = function (key, value, options) {
                    var lruEntry = lruHash[key] || (lruHash[key] = {key: key});

                    _refresh(lruEntry);

                    if (angular.isUndefined(value)) {
                        return;
                    }
                    if (!(key in data)) {
                        size++;
                    }
                    data[key] = {
                        timestamp: new Date().getTime(),
                        maxAge: (options && options.maxAge) || null,
                        value: value
                    };

                    if (size > capacity) {
                        this.remove(staleEnd.key);
                    }

                    return value;
                };

                /**
                 * @method AdvancedCache.get
                 * @desc Retrieve the item from the cache with the specified key.
                 * @param {string} key The key of the item to retrieve.
                 * @returns {*} The value of the item in the cache with the specified key.
                 * @public
                 *
                 * @example
                 angular.module('myModule').service('myService', ['$advancedCacheFactory', function ($advancedCacheFactory) {

                    var myCache = $advancedCacheFactory('myCache');

                    myCache.get('someItem'); // { name: 'John Doe', role: 'Manager' }
                });
                 */
                this.get = function (key) {
                    var lruEntry = lruHash[key];

                    if (!lruEntry) {
                        return;
                    }

                    if (_isExpired(data[key])) {
                        this.remove(key);
                        return;
                    }

                    _refresh(lruEntry);

                    return data[key].value;
                };

                /**
                 * @method AdvancedCache.remove
                 * @desc Remove the specified key-value pair from this cache.
                 * @param {string} key The key of the key-value pair to remove.
                 * @public
                 *
                 * @example
                 angular.module('myModule').service('myService', ['$advancedCacheFactory', function ($advancedCacheFactory) {

                    var myCache = $advancedCacheFactory('myCache');

                    myCache.remove('someItem');

                    myCache.get('someItem'); // undefined
                });
                 */
                this.remove = function (key) {
                    var lruEntry = lruHash[key];

                    if (!lruEntry) {
                        return;
                    }

                    if (lruEntry === freshEnd) {
                        freshEnd = lruEntry.p;
                    }
                    if (lruEntry === staleEnd) {
                        staleEnd = lruEntry.n;
                    }
                    _link(lruEntry.n, lruEntry.p);

                    delete lruHash[key];
                    delete data[key];
                    size--;
                };

                /**
                 * @method AdvancedCache.removeAll
                 * @desc Clear this cache.
                 * @public
                 *
                 * @example
                 angular.module('myModule').service('myService', ['$advancedCacheFactory', function ($advancedCacheFactory) {

                    var myCache = $advancedCacheFactory('myCache');

                    myCache.put('someItem', { name: 'John Doe' });
                    myCache.put('someOtherItem', { name: 'Sally Jean' });

                    myCache.removeAll();

                    myCache.get('someItem'); // undefined
                    myCache.get('someOtherItem'); // undefined
                });
                 */
                this.removeAll = function () {
                    data = {};
                    size = 0;
                    lruHash = {};
                    freshEnd = staleEnd = null;
                };

                /**
                 * @method AdvancedCache.destroy
                 * @desc Completely destroy this cache.
                 * @public
                 *
                 * @example
                 angular.module('myModule').service('myService', ['$advancedCacheFactory', function ($advancedCacheFactory) {

                    var myCache = $advancedCacheFactory('myCache');

                    myCache.put('someItem', { name: 'John Doe' });
                    myCache.put('someOtherItem', { name: 'Sally Jean' });

                    myCache.destroy();

                    myCache.get('someItem'); // Will throw an error - Don't try to use a cache after destroying it!

                    $advancedCacheFactory.get('myCache'); // undefined
                });
                 */
                this.destroy = function () {
                    data = null;
                    stats = null;
                    lruHash = null;
                    delete caches[cacheId];
                };

                /**
                 * @method AdvancedCache.info
                 * @desc Return an object containing information about this cache.
                 * @returns {object} stats Object containing information about this cache.
                 * @public
                 */
                this.info = function () {
                    return angular.extend({}, stats, {size: size});
                };
            }

            /**
             * @class advancedCacheFactory
             * @param {string} cacheId The id of the new cache.
             * @param {options} [options] { capacity: {number}, maxAge: {number} }
             * @returns {AdvancedCache}
             */
            function advancedCacheFactory(cacheId, options) {
                if (cacheId in caches) {
                    throw new Error('cacheId ' + cacheId + ' taken');
                }

                caches[cacheId] = new AdvancedCache(cacheId, options);
                return caches[cacheId];
            }

            /**
             * @method advancedCacheFactory.info
             * @desc Return an object containing information about all caches of this factory.
             * @returns {object} An object containing information about all caches of this factory.
             * @public
             *
             * @example
             angular.module('myModule').service('myService', ['$advancedCacheFactory', function ($advancedCacheFactory) {

                    var myCache = $advancedCacheFactory('myCache'),
                        myOtherCache = $advancedCacheFactory('myOtherCache');

                    console.log($advancedCacheFactory.info()); // { {id: 'myCache', size: 0}, {id: 'myOtherCache', size: 0} }
                });
             */
            advancedCacheFactory.info = function () {
                var info = {};
                angular.forEach(caches, function (cache, cacheId) {
                    info[cacheId] = cache.info();
                });
                return info;
            };

            /**
             * @method advancedCacheFactory.get
             * @desc Return the cache with the specified cacheId.
             * @param {string} cacheId The id of the desired cache.
             * @returns {AdvancedCache} The cache with the specified cachedId.
             * @public
             *
             * @example
             angular.module('myModule').service('myService', ['$advancedCacheFactory', function ($advancedCacheFactory) {

                    var myCache = $advancedCacheFactory.get('myCache');

                    // use can now use myCache
                });
             */
            advancedCacheFactory.get = function (cacheId) {
                return caches[cacheId];
            };

            return advancedCacheFactory;
        };
    }

    // Register the new provider with Angular.
    angular.module('ngAdvancedCache').provider('$advancedCacheFactory', $AdvancedCacheFactoryProvider);
})(window, window.angular);