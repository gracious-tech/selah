
import app_config from '@/app_config.json'
import {generate_uuid} from '@/services/utils'


export {getters_ as getters}
const getters_ = {

    client_names(state){
        // Return mapping of socket ids to unique client names for all clients known
        // WARN clients list may be hidden or limited (which is why msgs have own fallback)

        // Collect names and identify any duplicates
        const names = {}
        const seen_it = new Set()
        const clashes = new Set()
        const clients = [...state.tmp.room_clients.admins, ...state.tmp.room_clients.guests]
        for (const client of clients){
            // Give a default name if none provided
            const name = client.name || "Participant"
            names[client.socket] = name
            // Identify clash if any
            seen_it.has(name) ? clashes.add(name) : seen_it.add(name)
        }

        // Ensure names are unique by adding socket chars to clashes
        // NOTE four socket chars should be more than enough to resolve any clashes
        for (const [socket, name] of Object.entries(names)){
            if (clashes.has(name)){
                // WARN First 3 chars of socket do not seem to be random and often the same
                //      Also some chars in middle of socket string also seem non-random
                names[socket] += " (" + socket.substr(3, 4) + ")"
            }
        }

        return names
    },

}


export function actions(db, api){return {

    room_create({state}){
        // Create new room
        // NOTE Since may be first room joined, must provide name so server knows it
        api.send('room_create', {
            client_name: state.name,
            room_id_copy: null,
            room_name: app_config.domain === 'selah.cloud' ? null : 'Room',
        })
    },

    room_copy({state}, room_id){
        // Create copy of given room
        // NOTE Since may be first room joined, must provide name so server knows it
        api.send('room_create', {
            client_name: state.name,
            room_id_copy: room_id,
            room_name: null,  // Will copy existing room's name
        })
    },

    room_name({state}, name){
        // Change the name of the room
        api.send('room_name', {
            room_id: state.tmp.room.id,
            room_name: name,
        })
    },

    room_admins_only({state}, [permission, value]){
        // Change the value of an admins only permission
        api.send(`room_admins_only_${permission}`, {
            room_id: state.tmp.room.id,
            room_admins_only: value,
        })
    },

    room_message_send({state}, message){
        // Send a chat message
        api.send('room_message', {
            room_id: state.tmp.room.id,
            room_message: message,
        })
    },

    room_message_receive({state, commit}, message){
        // Add the message to the list of received messages
        // NOTE Order is best kept as received, even if unlikely chance of diff time order
        commit('tmp_add', ['room_messages', message])
        commit('tmp_set', ['room_messages_unread', state.tmp.room_messages_unread + 1])
    },

    async room_message_system({dispatch, getters, state}, args){
        // Directly add a system message to the room's messages
        dispatch('room_message_receive', {
            id: await generate_uuid(),  // NOTE Doesn't need to be same format as server, just unique
            room_id: state.tmp.room.id,
            sender: null,
            name: null,  // Set elsewhere
            timestamp: getters.get_server_time(),
            ...args,  // MUST include at least `html` arg
        })
    },

}}
