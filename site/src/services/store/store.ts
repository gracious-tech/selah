
import Vue from 'vue'
import {Store, StoreOptions} from 'vuex'
import {IDBPDatabase} from 'idb'

import API from '@/services/api'
import * as store_known_rooms from './store_known_rooms'
import * as store_client from './store_client'
import * as store_room from './store_room'
import * as store_media from './store_media'
import * as store_handlers from './store_handlers'
import {nested_objects_set, sleep, nested_objects_update, type_of} from '@/services/utils'
import {StateDatabase, db_value, init_db} from './store_db'
import {AppState, get_initial_state, KEY_SEPARATOR} from './store_state'


export async function get_store(){
    // Returns an instance of the store

    // Create store after idb setup so vuex will have access to it
    const db = await init_db()

    // Init api
    const api = new API()

    // Init store and give it access to db and api
    const store = new Store(await get_store_options(db, api))

    // Update viewport dimensions whenever size changes
    self.addEventListener('resize', () => {
        store.commit('tmp_set', ['viewport_width', self.document.documentElement.clientWidth])
        store.commit('tmp_set', ['viewport_height', self.document.documentElement.clientHeight])
    })

    // Start API connection and provide store (so store and api can both call each other)
    api.connect(store)

    return store
}


async function get_store_options(db:IDBPDatabase<StateDatabase>, api)
        :Promise<StoreOptions<AppState>>{return {

    strict: process.env.NODE_ENV !== 'production',  // Expensive, so don't run in production

    state: await get_initial_state(db),

    mutations: {

        dict_set(state, [key_or_keys, value]:[string|string[], db_value]){
            // Both set a value in the store and save it in the db

            // May have been given single key string, so convert to array to make simpler
            // NOTE Copy key_or_keys so original preserved for Vuex debugger to access
            const keys = Array.isArray(key_or_keys) ? key_or_keys.slice() : [key_or_keys]

            // Set in store
            nested_objects_set(state, keys, value)

            // Save in db
            // NOTE Below is async but does not affect app at all so ok in mutation
            const db_key = keys.join(KEY_SEPARATOR)
            db.put('dict', {key: db_key, value})
        },

        tmp_set(state, [key, value]){
            // Set a value in the store's tmp object (not saved to db)
            // If both target and value are objects, do a nested update
            // NOTE Still allows replacement if old or new value is null
            if (type_of(state.tmp[key]) === 'object' && type_of(value) === 'object'){
                nested_objects_update(state.tmp[key], value)
            } else {
                state.tmp[key] = value
            }
        },

        tmp_new(state, [container, key, value]){
            // Add a new property (or set existing) on a containing object
            Vue.set(state.tmp[container], key, value)
        },

        tmp_add(state, [key, item]){
            // Append an item to an array in tmp object
            state.tmp[key].push(item)
        },

        ...store_known_rooms.mutations(db, api),

    },

    getters: {
        ...store_known_rooms.getters,
        ...store_client.getters,
        ...store_room.getters,
        ...store_media.getters,
        ...store_handlers.getters,
    },

    actions: {

        async show_notification({state, commit}, message){
            // Display a message in a snackbar
            if (state.tmp.snackbar){
                // Another message already showing so trigger close and wait a moment
                // TODO In future might wait till its done or create queue system?
                commit('tmp_set', ['snackbar', false])
                await sleep(500)
            }
            commit('tmp_set', ['snackbar_text', message])
            commit('tmp_set', ['snackbar', true])
        },

        show_dialog({commit}, dialog){
            // Show the specified dialog
            commit('tmp_set', ['dialog', dialog ? `dialog-${dialog}` : null])
        },

        set_dark({commit}, value){
            // Change the value of dark and tell Vuetify about it
            commit('dict_set', ['dark', value])
            self._app.$vuetify.theme.dark = value
        },

        fund_selah({dispatch}){
            // Show the funding dialog for Selah
            dispatch('show_dialog', 'fund-selah')
        },

        fund_singit_session({}, amount){
            // Create checkout session (handler of response will redirect to checkout)
            api.send('payment_session', {
                payment_amount: amount,
                payment_return_url: self.location.href,
            })
        },

        ...store_known_rooms.actions(db, api),
        ...store_client.actions(db, api),
        ...store_room.actions(db, api),
        ...store_media.actions(db, api),
        ...store_handlers.actions(db, api),

    },
}}
