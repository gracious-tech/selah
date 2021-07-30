
<template lang='pug'>

div

    div(v-if='beta_release' class='release-banner') BETA

    v-toolbar(color='primary' light)

        v-toolbar-title
            app-brand

        v-spacer

        v-menu(bottom left transition='scale-transition' origin='80% 20px')
            template(#activator='{on}')
                v-btn(v-on='on' icon)
                    app-svg(name='icon_more_vert')

            v-list.main-menu
                v-list-item(to='settings/')
                    v-list-item-content
                        v-list-item-title
                            app-svg(name='icon_settings')
                            | Settings
                v-list-item(to='about/')
                    v-list-item-content
                        v-list-item-title
                            app-svg(name='icon_info')
                            | About
                v-list-item(@click='contact_dialog_show = true')
                    v-list-item-content
                        v-list-item-title
                            app-svg(name='icon_mail')
                            | Contact
                v-list-item(to='install/')
                    v-list-item-content
                        v-list-item-title
                            app-svg(name='icon_get_app')
                            | Install

    app-content(v-if='room_lists.length' class='pa-3')
        div(v-for='room_list in room_lists' :key='room_list.title')
            v-subheader(class='app-fg-primary-relative') {{ room_list.title }}
            v-list
                route-root-item(v-for='known_room in room_list.rooms' :known_room='known_room'
                    :key='known_room.id')

        div.actions(class='mt-3')
            div
                v-btn(@click='room_create' text color='accent') Create new room
            v-text-field.join(v-model='join_id' @keydown.enter='room_join' spellcheck='false'
                    :error-messages='join_id_error' placeholder="Join room (ID / URL)")
                template(#append)
                    v-btn(@click='room_join' :disabled='!join_id_cleaned' icon)
                        app-svg(name='icon_arrow_forward')

    div.empty(v-else)
        //- NOTE Hardcode theme (dark/light) since background is an image
        v-text-field.join(v-model='join_id' @keydown.enter='room_join' :error-messages='join_id_error'
                dark filled placeholder="Join room (ID / URL)" spellcheck='false')
            template(#append)
                v-btn(@click='room_join' :disabled='!join_id_cleaned' icon)
                    app-svg(name='icon_arrow_forward')
        v-btn(@click='room_create' light) Create new room

    app-install-banner

    app-contact-dialog(v-model='contact_dialog_show')

</template>


<script lang='ts'>

import {Component, Vue} from 'vue-property-decorator'

import AppBrand from '@/components/reuseable/AppBrand.vue'
import AppContactDialog from '@/components/reuseable/AppContactDialog.vue'
import AppInstallBanner from '@/components/reuseable/AppInstallBanner.vue'
import RouteRootItem from '@/components/routes/assets/RouteRootItem.vue'
import {prerelease} from '@/services/misc'


@Component({
    components: {AppBrand, AppContactDialog, AppInstallBanner, RouteRootItem},
})
export default class extends Vue {

    beta_release = prerelease === 'beta'
    join_id = ''
    contact_dialog_show = false

    get room_lists(){
        const lists = [
            {
                title: "Starred rooms",
                rooms: this.$store.getters.known_rooms_starred,
            },
            {
                title: "Admin of rooms",
                rooms: this.$store.getters.known_rooms_admin,
            },
            {
                title: "Previously visited",
                rooms: this.$store.getters.known_rooms_guest,
            },
        ]
        return lists.filter(i => i.rooms.length)
    }

    get join_id_cleaned(){
        // Return cleaned version of join id (which may be an id or a URL)
        try {
            let id = this.join_id.trim()
            if (id.includes('/')){
                // Assume dealing with a URL (ids cannot contain slashes)
                const url = new URL(id)
                if (url.hostname !== self.document.domain){
                    return null
                }
                id = url.pathname.split('/')[1]
            }
            // Ensure id is correct length
            // WARN Ensure length test updated if room_id specs ever change
            return id.length === 8 ? id : null
        } catch {
            return null
        }
    }

    get join_id_error(){
        // Return error message if room id is known to be invalid
        // NOTE Not using `rules` as not reactive (only updates when input changed)
        if (this.$store.state.tmp.invalid_rooms.includes(this.join_id_cleaned)){
            return "Room does not exist"
        }
        return ''
    }

    room_create(){
        this.$store.dispatch('room_create')
    }

    room_join(){
        if (this.join_id_cleaned){
            this.$store.dispatch('client_join', this.join_id_cleaned)
        }
    }

}

</script>


<style lang='sass' scoped>


.main-menu .v-list-item__title
    display: flex
    align-items: center

    svg
        margin-right: 12px


.join
    // Apply to join field, whether room lists empty or not
    width: 340px  // Large enough to fit whole URL if needed

    ::v-deep .v-input__append-inner
        // Center icon vertically
        margin-top: 0
        align-self: center


.actions
    display: flex
    flex-direction: column
    align-items: center


.empty
    flex-grow: 1
    background-image: url(/_assets/optional/no_rooms.jpg)
    background-size: cover
    display: flex
    flex-direction: column
    justify-content: center
    align-items: center
    padding: 18px

    .join
        // Don't push away from create button
        flex-grow: 0

        ::v-deep svg
            // Make button stand out more
            width: 36px
            height: 36px


</style>
