
<template lang='pug'>

div

    v-list(dense)
        route-room-clients-item(:client='you')
        route-room-clients-item(v-for='client of clients_admins' :client='client' :key='client.socket')
        route-room-clients-item(v-for='client of clients_guests' :client='client' :key='client.socket')
        div.notes
            div(v-if='hidden') Guests list is private
            div(v-if='limited') There are too many guests to list them all

    v-divider

    div.invite
        v-btn(@click='invite_guest' text color='primary') Invite guest
        //- TODO v-btn(v-if='you.admin' text color='primary') Invite admin

    v-dialog(v-model='invite_dialog')
        v-card
            v-card-title Invite Guest
            v-card-text
                p Share this link to the room to invite new guests. Anyone who has this link will be able to join, so only share privately if a private room.
                v-text-field(:value='room_url' readonly)
            v-card-actions
                v-btn(@click='invite_dialog = false' text color='primary') Dismiss


</template>


<script lang='ts'>

import {Component, Vue, Prop} from 'vue-property-decorator'

import app_config from '@/app_config.json'
import RouteRoomClientsItem from './RouteRoomClientsItem.vue'


@Component({
    components: {RouteRoomClientsItem},
})
export default class extends Vue {

    invite_dialog = false

    get clients(){
        // Shortcut to room_clients
        return this.$store.state.tmp.room_clients
    }

    get hidden(){
        // Whether clients list is hidden
        return !this.$store.state.tmp.room_admin && this.clients.hidden
    }

    get limited(){
        // Whether clients list is limited
        // NOTE No point in saying limited if can't see anyway!
        return !this.hidden && this.clients.limited
    }

    get you(){
        // Construct client item for self from own state as more up-to-date than server responses
        return {
            socket: null,  // null = self in this case
            name: null,  // Won't use
            admin: this.$store.state.tmp.room_admin,
            synced: this.$store.state.tmp.room_synced,
        }
    }

    get clients_admins(){
        // Return clients who are admins (and exclude self)
        const clients = this.clients.admins
        const own_sockets = this.$store.state.tmp.own_sockets
        return clients.filter(c => !own_sockets.includes(c.socket))
    }

    get clients_guests(){
        // Return clients who are NOT admins (and exclude self)
        const clients = this.clients.guests
        const own_sockets = this.$store.state.tmp.own_sockets
        return clients.filter(c => !own_sockets.includes(c.socket))
    }

    get room_url(){
        // Return room URL without any query/hash etc
        return `https://${self.document.domain}/${this.$store.state.tmp.room.id}/`
    }

    invite_guest(){
        // Invite a guest by sharing URL with them

        // Prefer share API if available
        if ('share' in self.navigator){
            self.navigator.share({
                url: this.room_url,
                title: `${app_config.short_name}: ${this.$store.state.tmp.room.name}`,
            })
        } else {
            // If clipboard API supported, copy URL straight away
            if ('clipboard' in self.navigator){
                // TODO Resolve weird TS issue below
                ;(self.navigator as any).clipboard.writeText(this.room_url).then(() => {
                    this.$store.dispatch('show_notification', "Room link copied")
                })
            }
            // Show dialog even if already copied link
            this.invite_dialog = true
        }
    }

}

</script>


<style lang='sass' scoped>


.v-list
    // Make list take up space and scroll if needed
    flex-grow: 1
    overflow-y: auto

    .notes
        text-align: center
        opacity: 0.7
        font-size: 14px
        margin: 24px 0

.v-divider
    margin: 0  // spacing handled by other elements


.invite
    // Center invite buttons and provide spacing
    margin: 12px 0
    display: flex
    justify-content: space-around


// Give clients list a max-height if inside a panel (as panel has no fixed height, unlike tab)
@at-root .v-expansion-panel .v-list
    max-height: 400px


</style>
