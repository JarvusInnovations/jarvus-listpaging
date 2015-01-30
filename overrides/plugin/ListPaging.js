Ext.define('Jarvus.plugin.ListPaging', {
    override: 'Ext.plugin.ListPaging',

    config: {
        /**
         * @cfg {Boolean} autoPaging
         * True to automatically load the next page when you scroll to the bottom of the list.
         */
        autoPaging: false,

        /**
         * @cfg {String} loadMoreText The text used as the label of the Load More button.
         */
        loadMoreText: 'Load More...',

        /**
         * @cfg {String} noMoreRecordsText The text used as the label of the Load More button when the Store's
         * {@link Ext.data.Store#totalCount totalCount} indicates that all of the records available on the server are
         * already loaded
         */
        noMoreRecordsText: 'No More Records',

        /**
         * @private
         * @cfg {String} loadTpl The template used to render the load more text
         */
        loadTpl: [
            '<div class="{cssPrefix}loading-spinner" style="font-size: 180%; margin: 10px auto;">',
                 '<span class="{cssPrefix}loading-top"></span>',
                 '<span class="{cssPrefix}loading-right"></span>',
                 '<span class="{cssPrefix}loading-bottom"></span>',
                 '<span class="{cssPrefix}loading-left"></span>',
            '</div>',
            '<div class="{cssPrefix}list-paging-msg">{message}</div>'
        ].join(''),

        /**
         * @cfg {Object} loadMoreCmp
         * @private
         */
        loadMoreCmp: {
            xtype: 'component',
            baseCls: Ext.baseCSSPrefix + 'list-paging',
            scrollDock: 'bottom',
            hidden: true
        },

        /**
         * @private
         * @cfg {Boolean} loadMoreCmpAdded Indicates whether or not the load more component has been added to the List
         * yet.
         */
        loadMoreCmpAdded: false,

        /**
         * @private
         * @cfg {String} loadingCls The CSS class that is added to the {@link #loadMoreCmp} while the Store is loading
         */
        loadingCls: Ext.baseCSSPrefix + 'loading',

        /**
         * @private
         * @cfg {Ext.Dataview} list Local reference to the List this plugin is bound to
         */
        list: null,

        /**
         * @private
         * @cfg {Ext.scroll.Scroller} scroller Local reference to the List's Scroller
         */
        scroller: null,
        
        
        /**
         * @private
         * @cfg {string} set xtype to use parent's scroller. Useful for auto layouts that are dynamic.
         */
        parentScrollerContainerXtype: false,

        /**
         * @private
         * @cfg {Boolean} loading True if the plugin has initiated a Store load that has not yet completed
         */
        loading: false
    },

    /**
     * @private
     * Sets up all of the references the plugin needs
     */
    init: function(list) {
        var me = this,
            parentScrollerContainerXtype = me.getParentScrollerContainerXtype(),
            scroller, store,
            _initFn = function() {

                if(parentScrollerContainerXtype) {
                    scroller = list.up(parentScrollerContainerXtype).getScrollable().getScroller();
                } else {
                    scroller = list.getScrollable().getScroller();
                }

                store    = list.getStore();
                
                me.setList(list);
                me.setScroller(scroller);
                me.bindStore(list.getStore());
        
                me.addLoadMoreCmp();
        
                // The List's Store could change at any time so make sure we are informed when that happens
                list.updateStore = Ext.Function.createInterceptor(list.updateStore, me.bindStore, me);
        
                if (me.getAutoPaging()) {
                    scroller.on({
                        scrollend: me.onScrollEnd,
                        scope: me
                    });
                }
            }
        
        if(list.rendered) {
            _initFn();
        } else {
            list.on('painted', _initFn, me, {single: true});
        }
    },

    /**
     * @private
     */
    bindStore: function(newStore, oldStore) {
        var me = this;
        
        if (oldStore) {
            oldStore.un({
                beforeload: me.onStoreBeforeLoad,
                load: me.onStoreLoad,
                filter: me.onFilter,
                scope: me
            });
        }

        if (newStore) {
            newStore.on({
                beforeload: me.onStoreBeforeLoad,
                load: me.onStoreLoad,
                filter: me.onFilter,
                scope: me
            });
        }
    },

    /**
     * @private
     * Removes the List/DataView's loading mask because we show our own in the plugin. The logic here disables the
     * loading mask immediately if the store is autoloading. If it's not autoloading, allow the mask to show the first
     * time the Store loads, then disable it and use the plugin's loading spinner.
     * @param {Ext.data.Store} store The store that is bound to the DataView
     */
    disableDataViewMask: function() {
        var list = this.getList();
            this._listMask = list.getLoadingText();

        list.setLoadingText(null);
    },

    enableDataViewMask: function() {
        if(this._listMask) {
            var list = this.getList();
            list.setLoadingText(this._listMask);
            delete this._listMask;
        }
    },

    /**
     * @private
     */
    applyLoadTpl: function(config) {
        return (Ext.isObject(config) && config.isTemplate) ? config : new Ext.XTemplate(config);
    },

    /**
     * @private
     */
    applyLoadMoreCmp: function(config) {
        config = Ext.merge(config, {
            html: this.getLoadTpl().apply({
                cssPrefix: Ext.baseCSSPrefix,
                message: this.getLoadMoreText()
            }),
            scrollDock: 'bottom',
            listeners: {
                tap: {
                    fn: this.loadNextPage,
                    scope: this,
                    element: 'element'
                }
            }
        });

        return Ext.factory(config, Ext.Component, this.getLoadMoreCmp());
    },

    /**
     * @private
     * If we're using autoPaging and detect that the user has scrolled to the bottom, kick off loading of the next page
     */
    onScrollEnd: function(scroller, x, y) {
        var list = this.getList();

        if (!this.getLoading() && y >= scroller.maxPosition.y) {
            this.currentScrollToTopOnRefresh = list.getScrollToTopOnRefresh();
            list.setScrollToTopOnRefresh(false);

            this.loadNextPage();
        }
    },

    /**
     * @private
     * Makes sure we add/remove the loading CSS class while the Store is loading
     */
    updateLoading: function(isLoading) {
        var loadMoreCmp = this.getLoadMoreCmp(),
            loadMoreCls = this.getLoadingCls();

        if (isLoading) {
            loadMoreCmp.addCls(loadMoreCls);
        } else {
            loadMoreCmp.removeCls(loadMoreCls);
        }
    },

    /**
     * @private
     * If the Store is just about to load but it's currently empty, we hide the load more button because this is
     * usually an outcome of setting a new Store on the List so we don't want the load more button to flash while
     * the new Store loads
     */
    onStoreBeforeLoad: function(store) {
        if (store.getCount() === 0) {
            this.getLoadMoreCmp().hide();
        }
    },

    /**
     * @private
     */
    onStoreLoad: function(store) {
        var loadCmp  = this.getLoadMoreCmp(),
            template = this.getLoadTpl(),
            message  = this.storeFullyLoaded() ? this.getNoMoreRecordsText() : this.getLoadMoreText();

        if (store.getCount()) {
            console.log(message, store.getCount());
            loadCmp.show();
        }
        this.setLoading(false);
        
        //if we've reached the end of the data set, switch to the noMoreRecordsText
        loadCmp.setHtml(template.apply({
            cssPrefix: Ext.baseCSSPrefix,
            message: message
        }));

        if (this.currentScrollToTopOnRefresh !== undefined) {
            this.getList().setScrollToTopOnRefresh(this.currentScrollToTopOnRefresh);
            delete this.currentScrollToTopOnRefresh;
        }

        this.enableDataViewMask();
    },

    onFilter: function(store) {
        if (store.getCount() === 0) {
            this.getLoadMoreCmp().hide();
        }else {
            this.getLoadMoreCmp().show();
        }
    },

    /**
     * @private
     * Because the attached List's inner list element is rendered after our init function is called,
     * we need to dynamically add the loadMoreCmp later. This does this once and caches the result.
     */
    addLoadMoreCmp: function() {
        var list = this.getList(),
            cmp  = this.getLoadMoreCmp();

        if (!this.getLoadMoreCmpAdded()) {
            list.add(cmp);

            /**
             * @event loadmorecmpadded  Fired when the Load More component is added to the list. Fires on the List.
             * @param {Ext.plugin.ListPaging} this The list paging plugin
             * @param {Ext.List} list The list
             */
            list.fireEvent('loadmorecmpadded', this, list);
            this.setLoadMoreCmpAdded(true);
        }

        return cmp;
    },

    /**
     * @private
     * Returns true if the Store is detected as being fully loaded, or the server did not return a total count, which
     * means we're in 'infinite' mode
     * @return {Boolean}
     */
    storeFullyLoaded: function() {
        var store = this.getList().getStore(),
            total = store.getTotalCount();

        return total !== null ? store.getTotalCount() <= (store.currentPage * store.getPageSize()) : false;
    },

    /**
     * @private
     */
    loadNextPage: function() {
        var me = this;
        if (!me.storeFullyLoaded()) {
            me.disableDataViewMask();
            me.setLoading(true);
            me.getList().getStore().nextPage({ addRecords: true });
        }
    }
});