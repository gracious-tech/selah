
<template lang='pug'>

v-list-item(:to='`/${known_room.id}/`')
    v-list-item-content
        v-list-item-title {{ known_room.name }}
    v-list-item-action
        //- WARN Need to `prevent` on click handlers because v-list-item uses `to` not `click`
        v-btn(@click.prevent='toggle_star' icon)
            app-svg(:name='known_room.starred ? "icon_star" : "icon_star_border"')
        v-menu(bottom left transition='scale-transition' origin='80% 20px')
            template(#activator='{on}')
                v-btn(@click.prevent='on.click' icon)
                    app-svg(name='icon_more_vert')
            v-list
                v-list-item(@click='copy_room')
                    v-list-item-content
                        v-list-item-title Create copy
                v-list-item(@click='forget_room')
                    v-list-item-content
                        v-list-item-title Remove from history
                v-list-item(v-if='admin' @click='delete_dialog = true')
                    v-list-item-content
                        v-list-item-title Delete room for everyone

    v-dialog(v-model='delete_dialog')
        v-card
            v-card-title Delete room
            v-card-text This will permanently delete room "{{ known_room.name }}" for all users, and cannot be undone.
            v-card-actions
                v-btn(@click='delete_dialog = false' text color='primary') Cancel
                v-btn(@click='delete_room' color='error' text) Delete for all

</template>


<script lang='ts'>

import {Component, Vue, Prop, Watch} from 'vue-property-decorator'


@Component({})
export default class extends Vue {

    delete_dialog = false

    @Prop() known_room

    @Watch('known_room') watch_known_room(){
        // Ensure dialog closed before reuse component for another room
        this.delete_dialog = false
    }

    get admin(){
        // Whether user is admin of this room (knows secret)
        return !! this.known_room.secret
    }

    toggle_star(){
        // Toggle the star status of the room
        this.$store.dispatch('known_rooms_star_toggle', this.known_room.id)
    }

    copy_room(){
        // Create a copy of the room
        this.$store.dispatch('room_copy', this.known_room.id)
    }

    forget_room(){
        // Remove this room from own history
        this.$store.dispatch('known_rooms_forget', this.known_room.id)
    }

    delete_room(){
        // Permanently delete this room from server and history
        this.delete_dialog = false
        this.$store.dispatch('known_rooms_delete', this.known_room.id)
    }

}

</script>


<style lang='sass' scoped>


// Only show actions when hovering over item (only for devices that support hovering)
@media (hover: hover)
    .v-list-item:not(:hover) .v-list-item__action
        visibility: hidden


// Display actions horizontally
.v-list-item__action
    flex-direction: row


</style>
