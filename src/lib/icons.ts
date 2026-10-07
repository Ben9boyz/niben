import type { Component } from 'vue'
import {
  Clapperboard, Tv, Dice5, ChefHat, Croissant, Coffee, Wine, Sprout, Fish, PawPrint, Gamepad2, Blocks, Plane, Palette, Camera, Scissors, Wrench,
  Piano, Music4, Mic, Gem, Bookmark, Bird, Telescope, Footprints, Bike, Dumbbell, Waves, Mountain, Tent, Crown, PenLine, Languages, Flower2,
  NotebookPen, Car, Gift, Target, Shovel, Luggage, Medal, UtensilsCrossed, Trophy, Star, House, GraduationCap, Hammer, Compass, Heart, Flame,
  Briefcase, Globe, BookOpen, Guitar, Timer, Code2, User, Disc3, Music, Leaf, Activity, Puzzle, Sparkles, Brush, Drama, Swords, Glasses,
} from 'lucide-vue-next'

// The site's symbols, by name – what a hobby, a tab or a corner is shown with (stored as the name, e.g. "Bike"). Never emoji:
// everything is drawn with the same icon set as the rest of the site.
export const ICONS: Record<string, Component> = {
  Clapperboard, Tv, Dice5, ChefHat, Croissant, Coffee, Wine, Sprout, Fish, PawPrint, Gamepad2, Blocks, Plane, Palette, Camera, Scissors, Wrench,
  Piano, Music4, Mic, Gem, Bookmark, Bird, Telescope, Footprints, Bike, Dumbbell, Waves, Mountain, Tent, Crown, PenLine, Languages, Flower2,
  NotebookPen, Car, Gift, Target, Shovel, Luggage, Medal, UtensilsCrossed, Trophy, Star, House, GraduationCap, Hammer, Compass, Heart, Flame,
  Briefcase, Globe, BookOpen, Guitar, Timer, Code2, User, Disc3, Music, Leaf, Activity, Puzzle, Sparkles, Brush, Drama, Swords, Glasses,
}
/** The ones offered when you pick a symbol yourself. */
export const PICKABLE = ['Star', 'Heart', 'Flame', 'Sparkles', 'House', 'GraduationCap', 'Hammer', 'Compass', 'Briefcase', 'Globe', 'BookOpen', 'Music', 'Guitar', 'Disc3',
  'Waves', 'Footprints', 'Bike', 'Dumbbell', 'Activity', 'Mountain', 'Tent', 'Fish', 'Leaf', 'Sprout', 'PawPrint', 'Bird', 'Clapperboard', 'Tv', 'Gamepad2', 'Dice5',
  'Puzzle', 'Crown', 'Palette', 'Brush', 'Camera', 'ChefHat', 'Coffee', 'Wine', 'Plane', 'Luggage', 'Car', 'Code2', 'PenLine', 'Languages', 'Telescope', 'Trophy']
/** The symbol for a name (an unknown one – an old emoji, a typo – gets the star). */
export const iconOf = (name: string | null | undefined): Component => (name && ICONS[name]) || Star
export const isIcon = (name: unknown): name is string => typeof name === 'string' && name in ICONS
