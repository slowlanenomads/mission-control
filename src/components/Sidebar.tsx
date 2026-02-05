import { NavLink } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, Clock, Brain, Settings } from 'lucide-react'
const nav = [{ to:'/',icon:LayoutDashboard,label:'Dashboard' },{ to:'/sessions',icon:MessageSquare,label:'Sessions' },{ to:'/cron',icon:Clock,label:'Cron Jobs' },{ to:'/memory',icon:Brain,label:'Memory' },{ to:'/settings',icon:Settings,label:'Settings' }]
export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-gray-900 border-r border-gray-800 flex flex-col z-50">
      <div className="p-4 border-b border-gray-800"><div className="flex items-center gap-2"><span className="text-2xl">🦞</span><div><h1 className="font-bold text-sm text-gray-100">Mission Control</h1><div className="flex items-center gap-1.5 mt-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" /><span className="text-[10px] text-green-400 uppercase tracking-wider font-medium">Live</span></div></div></div></div>
      <nav className="flex-1 p-2 space-y-1">{nav.map(({to,icon:Icon,label})=>(<NavLink key={to} to={to} end={to==='/'} className={({isActive})=>`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive?'bg-gray-800 text-white font-medium':'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}><Icon size={18}/>{label}</NavLink>))}</nav>
      <div className="p-4 border-t border-gray-800"><p className="text-[10px] text-gray-600">OpenClaw v0.1.0</p></div>
    </aside>
  )
}
