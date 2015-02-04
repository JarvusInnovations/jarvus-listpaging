/* jshint undef: true, unused: true, browser: true, quotmark: single, curly: true */
/* global Ext */
Ext.define('Jarvus.touch.plugin.DataViewPaging', {
    extend: 'Ext.plugin.ListPaging',

    /**
     * @private
     * Sets up all of the references the plugin needs
     */
    init: function(dataView) {
        var me = this;

        function _initializeScroller() {
            var container = dataView.up('container{getScrollable()}'),
                scroller = container.getScrollable().getScroller();

            me.setList(dataView);
            me.setScroller(scroller);
            me.bindStore(dataView.getStore());

            me.addLoadMoreCmp();

            // The List's Store could change at any time so make sure we are informed when that happens
            dataView.updateStore = Ext.Function.createInterceptor(dataView.updateStore, me.bindStore, me);

            if (me.getAutoPaging()) {
                scroller.on('scrollend', 'onScrollEnd', me);
            }
        }

        if (dataView.rendered) {
            _initializeScroller();
        } else {
            dataView.on('painted', _initializeScroller);
        }
    }
});