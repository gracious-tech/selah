
<template lang='pug'>

v-list-item(@click='load' :disabled='deny_dj' :color='color')

    v-list-item-avatar(v-if='item.type === "youtube"')
        v-img(:src='`https://img.youtube.com/vi/${this.item.content.id}/default.jpg`')
    v-list-item-icon(v-else)
        app-svg(name='icon_subject')

    v-list-item-content
        v-list-item-title {{ name }}

    v-list-item-action(v-if='!deny_dj')
        //- WARN Need to `stop` on click handlers because v-list-item uses `click` not `to`
        v-btn(@click.stop='move_up' :disabled='is_first' icon)
            app-svg(name='icon_arrow_upward')
        v-btn(@click.stop='move_down' :disabled='is_last' icon)
            app-svg(name='icon_arrow_downward')
        v-menu(bottom left transition='scale-transition' origin='80% 20px')
            template(#activator='{on}')
                v-btn(v-on='on' icon)
                    app-svg(name='icon_more_vert')
            v-list
                // TODO
                //- v-list-item
                //-     v-list-item-content
                //-         v-list-item-title Edit
                v-list-item(@click='remove')
                    v-list-item-content
                        v-list-item-title Remove

</template>


<script lang='ts'>

import {Component, Vue, Prop} from 'vue-property-decorator'


@Component({})
export default class extends Vue {

    @Prop() item

    get deny_dj(){
        return this.$store.getters.deny_dj
    }

    get room(){
        return this.$store.state.tmp.room
    }

    get name(){
        return this.item.name
    }

    get color(){
        // Use accent color if this item is currently playing
        return this.room.media[this.room.loaded] === this.item ? 'accent' : undefined
    }

    get index(){
        // Return the index for the item in the media list
        return this.room.media.findIndex(item => item === this.item)
    }

    get is_first(){
        // Return true if item is the first in media list
        return this.index === 0
    }

    get is_last(){
        // Return true if item is the last in media list
        return this.index === this.room.media.length - 1
    }

    load(){
        // Load this media item
        this.$store.dispatch('media_load', this.item.id)
    }

    remove(){
        // Remove this media item
        this.$store.dispatch('media_remove', this.item.id)
    }

    move_up(){
        // Swap the item with the one before it
        const prev_item_id = this.room.media[this.index - 1].id
        this.$store.dispatch('media_rearrange', [this.item.id, prev_item_id])
    }

    move_down(){
        // Swap the item with the one after it
        const next_item_id = this.room.media[this.index + 1].id
        this.$store.dispatch('media_rearrange', [next_item_id, this.item.id])
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
