
export {getters_ as getters}
const getters_ = {

    secret(state){
        // Return secret for current room (if known)
        return state.known_rooms[state.tmp.room?.id]?.secret || null
    },

    deny_dj(state){
        // True if not allowed to dj
        return !state.tmp.room_admin && state.tmp.room.admins_only_dj
    },

    deny_see_clients(state){
        // True if not allowed to see clients
        // NOTE Can't determine from clients list alone as could just be self in room at the time
        return !state.tmp.room_admin && state.tmp.room.admins_only_see_clients
    },

    deny_chat(state){
        // True if not allowed to chat
        return !state.tmp.room_admin && state.tmp.room.admins_only_chat
    },

    get_server_time(state){
        // Return estimated server time (accounting for client's time diff)
        // NOTE Output is a timestamp in seconds
        // NOTE Only available when in a room, though could implement new method to return outside
        // NOTE Must be called to get value, otherwise Vue would cache and not update despite time
        return () => new Date().getTime() / 1000 - (state.tmp.time_diff / 1000 || 0)
    },

}


export function actions(db, api){return {

    client_join({state}, room_id){
        // Join a room (rely on watches/handlers to actually navigate to the room)
        api.send('client_join', {
            room_id: room_id,
            room_secret: state.known_rooms[room_id]?.secret || null,  // May not know room yet
            client_name: state.name,
        })
    },

    client_leave({state, commit}){
        // If not in a room do nothing (was triggered somehow before so must be possible)
        if (!state.tmp.room){
            return
        }
        // Leave the current room
        api.send('client_leave', {
            room_id: state.tmp.room.id,
        })
        // Don't wait for response to clear state
        commit('tmp_set', ['room', null])
        commit('tmp_set', ['room_clients', null])
        commit('tmp_set', ['room_admin', null])
        commit('tmp_set', ['room_synced', null])
        commit('tmp_set', ['room_messages', []])
        commit('tmp_set', ['room_messages_unread', 0])
    },

    client_name({commit}, name){
        // Set own name
        commit('dict_set', ['name', name])
        api.send('client_name', {
            client_name: name,
        })
    },

    client_synced({commit, state}, seconds){
        // Determine if synced status has changed "significantly" and update server if it has

        // Value provided in seconds but will be recorded in ms
        const ms = seconds === null ? null : Math.floor(seconds * 1000)

        // Do nothing if didn't change significantly
        // NOTE Synced will always vary on every check so only reporting if change significant
        const prev = state.tmp.room_synced
        if (ms === prev){
            return  // Mainly to exclude both being null
        }
        if (ms !== null && prev !== null && Math.abs(ms - prev) < 10){
            return  // Changed ms but not significant enough to tell server (or user) about
        }

        // Record in store so can display status, and report to server
        commit('tmp_set', ['room_synced', ms])
        api.send('client_synced', {
            client_synced: ms,
        })
    },

    client_feedback({}, {feedback, email}){
        // Send feedback to admin
        api.send('client_feedback', {
            client_feedback: feedback,
            client_email: email,
            client_user_agent: self.navigator.userAgent,
        })
    },

}}
