
import Vue from 'vue'


export function mutations(db, api){return {

    known_rooms_set(state, [room_id, props]){
        // Create or update a known room
        Vue.set(state.known_rooms, room_id, props)
        // Save in db
        // NOTE Below is async but does not affect app at all so ok in mutation
        db.put('known_rooms', {id: room_id, ...props})
    },

    known_rooms_remove(state, room_id){
        // Remove a room from the store and from db

        // Remove the room from state
        Vue.delete(state.known_rooms, room_id)

        // Remove the room from the db
        db.delete('known_rooms', room_id)
    },

}}


export {getters_ as getters}
const getters_ = {

    known_rooms_sorted(state){
        // Return known rooms as an array (normally a dict/object) sorted by last entered
        return Object.entries(state.known_rooms).map(key_val => {
            return {
                id: key_val[0],
                ...(key_val[1] as any),
            }
        }).sort((a, b) => {
            if (a.last_entered === b.last_entered){
                return 0
            }
            return a.last_entered > b.last_entered ? -1 : 1
        })
    },

    known_rooms_starred(state, getters){
        // Return all starred rooms
        return getters.known_rooms_sorted.filter(room => room.starred)
    },

    known_rooms_admin(state, getters){
        // Return all rooms where the user is admin (including starred rooms)
        return getters.known_rooms_sorted.filter(room => room.secret !== null)
    },

    known_rooms_guest(state, getters){
        // Return all rooms where the user is NOT admin (including starred rooms)
        return getters.known_rooms_sorted.filter(room => room.secret === null)
    },

}


export function actions(db, api){return {

    async known_rooms_update({commit}, [room_id, change]){
        // Set values for the given keys for the room (or create room)

        // Start with defaults (to ensure new rooms have all fields)
        const room_data = {
            name: "Room",
            secret: null,
            starred: null,
            last_entered: new Date(),
        }

        // Get any existing data and replace the defaults with it
        // NOTE Looping over known fields (don't want to add id field as state is keyed by id)
        const existing_data = await db.get('known_rooms', room_id) || {}
        for (const key of Object.keys(room_data)){
            if (key in existing_data){
                room_data[key] = existing_data[key]
            }
        }

        // Overwrite with given data
        for (const key of Object.keys(change)){
            room_data[key] = change[key]
        }

        // Commit the changes to state and db
        commit('known_rooms_set', [room_id, room_data])
    },

    known_rooms_star_toggle({state, dispatch}, room_id){
        // Toggle whether the room is starred or not
        dispatch('known_rooms_update', [room_id, {
            starred: !state.known_rooms[room_id].starred,
        }])
    },

    known_rooms_forget({commit}, room_id){
        // Remove the room from state and db
        commit('known_rooms_remove', room_id)
    },

    known_rooms_delete({state}, room_id){
        // Request the room to be deleted
        // NOTE Don't remove from state in case msg fails (allow server response to do that)
        api.send('room_delete', {
            room_id: room_id,
            room_secret: state.known_rooms[room_id].secret,
        })
    },

}}
