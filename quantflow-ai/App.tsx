import React, { useState, useMemo, useEffect } from 'react';
import { Activity, Layers, User, Plus, Search, Shield, ChevronRight, Globe, TrendingUp, Users } from 'lucide-react';
import { MOCK_PORTFOLIO_DATA, MOCK_STRATEGIES, COMMUNITY_STRATEGIES } from './constants';
import { Strategy, TimeRange } from './types';
import PortfolioChart from './components/PortfolioChart';
import StrategyList from './components/StrategyList';
import StrategyDetail from './components/StrategyDetail';

type Tab = 'trade' | 'strategies' | 'community' | 'profile';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('trade');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentPrice = useMemo(() => {
    const data = MOCK_PORTFOLIO_DATA[timeRange];
    return data[data.length - 1].value;
  }, [timeRange]);

  const startPrice = useMemo(() => {
    const data = MOCK_PORTFOLIO_DATA[timeRange];
    return data[0].value;
  }, [timeRange]);

  const priceDiff = currentPrice - startPrice;
  const percentDiff = (priceDiff / startPrice) * 100;
  const isPositive = priceDiff >= 0;
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  // --- Views ---

  const PortfolioSection = () => (
    <div className="flex flex-col">
      <div className="pt-6 md:pt-10 px-6 pb-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tighter text-white">
          {formatCurrency(currentPrice)}
        </h1>
        <div className={`flex items-center gap-2 text-sm font-medium mt-1 ${isPositive ? 'text-[#00C805]' : 'text-[#FF5000]'}`}>
          <span>{isPositive ? '+' : ''}{formatCurrency(priceDiff)}</span>
          <span>({isPositive ? '+' : ''}{percentDiff.toFixed(2)}%)</span>
          <span className="text-gray-500 uppercase">{timeRange === '1D' ? 'Today' : 'Past ' + timeRange}</span>
        </div>
      </div>
      <div className="relative w-full h-64 md:h-80">
         <PortfolioChart data={MOCK_PORTFOLIO_DATA[timeRange]} isPositive={isPositive} />
      </div>
      <div className="flex justify-between px-6 py-4 border-b border-neutral-900 overflow-x-auto no-scrollbar">
        {(['1D', '1W', '1M', '3M', '1Y'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`text-xs font-bold py-1 px-4 rounded-md transition-colors whitespace-nowrap ${
              timeRange === range ? 'bg-neutral-800 text-white' : 'text-gray-500 hover:text-white'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );

  const TradeView = () => (
    <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 px-0 md:px-6">
      <div className="md:col-span-8">
        <PortfolioSection />
        <div className="px-6 md:px-0 mt-8">
          <h2 className="text-xl font-bold text-white mb-4">News & Activity</h2>
          <div className="space-y-4">
            <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 flex gap-4 items-start">
               <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400"><Globe size={20}/></div>
               <div>
                  <h4 className="font-bold text-sm">Market Update</h4>
                  <p className="text-xs text-gray-500">Bitcoin hash rate hits new all-time high as network security strengthens.</p>
               </div>
            </div>
          </div>
        </div>
      </div>
      <div className="hidden md:block md:col-span-4 mt-10">
        <div className="sticky top-24 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
           <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
              Active Strategies
              <span className="text-xs font-normal text-gray-500">Live</span>
           </h3>
           <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
              {MOCK_STRATEGIES.map(s => (
                <div key={s.id} onClick={() => setSelectedStrategy(s)} className="p-3 bg-black rounded-xl border border-neutral-800 hover:border-neutral-700 cursor-pointer transition">
                   <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm truncate">{s.name}</span>
                      <span className={`text-xs font-mono ${s.returnPercentage >= 0 ? 'text-[#00C805]' : 'text-[#FF5000]'}`}>{s.returnPercentage}%</span>
                   </div>
                   <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s.type}</div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );

  const StrategiesView = () => (
    <div className="max-w-4xl mx-auto px-6 pt-12">
       <div className="flex justify-between items-center mb-8">
         <h1 className="text-3xl font-bold text-white">Your Strategies</h1>
         <button className="bg-white text-black rounded-full px-6 py-2 font-bold hover:bg-gray-200 transition flex items-center gap-2">
            <Plus size={18} /> New Bot
         </button>
       </div>
       <div className="relative mb-8">
          <Search className="absolute left-3 top-3.5 text-gray-500 w-5 h-5" />
          <input 
             type="text" 
             placeholder="Search my library..." 
             className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-white transition"
          />
       </div>
       <StrategyList strategies={MOCK_STRATEGIES} onSelect={setSelectedStrategy} />
    </div>
  );

  const CommunityView = () => (
    <div className="max-w-4xl mx-auto px-6 pt-12">
       <div className="mb-8">
         <h1 className="text-3xl font-bold text-white">Community Alpha</h1>
         <p className="text-gray-500 mt-2">Discover and copy strategies from the top quant traders in the ecosystem.</p>
       </div>
       
       <div className="grid grid-cols-1 gap-6 pb-24">
          {COMMUNITY_STRATEGIES.map((s) => (
            <div 
                key={s.id} 
                className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 hover:border-purple-500/50 transition-all cursor-pointer group"
                onClick={() => setSelectedStrategy(s)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4 items-center">
                   <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xl">
                      {s.creator[1].toUpperCase()}
                   </div>
                   <div>
                      <h3 className="font-bold text-white text-lg">{s.name}</h3>
                      <p className="text-sm text-purple-400 font-medium">{s.creator}</p>
                   </div>
                </div>
                <div className="text-right">
                   <div className="text-[#00C805] font-bold text-xl">+{s.returnPercentage}%</div>
                   <div className="text-xs text-gray-500 uppercase tracking-widest">Historical</div>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-6 line-clamp-2">{s.description}</p>
              
              <div className="flex justify-between items-center border-t border-neutral-800 pt-4">
                 <div className="flex gap-6">
                    <div className="flex items-center gap-2 text-gray-500">
                       <Users size={16} />
                       <span className="text-xs font-bold">{s.followers.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                       <TrendingUp size={16} />
                       <span className="text-xs font-bold">{s.winRate}% Win</span>
                    </div>
                 </div>
                 <button className="text-xs bg-white text-black px-4 py-2 rounded-full font-bold group-hover:bg-[#00C805] group-hover:text-white transition-colors">
                    Copy Strategy
                 </button>
              </div>
            </div>
          ))}
       </div>
    </div>
  );

  const ProfileView = () => (
    <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
       <div className="text-center mb-10">
          <div className="w-24 h-24 bg-neutral-800 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold">JD</div>
          <h1 className="text-3xl font-bold text-white">John Doe</h1>
          <p className="text-gray-500">quant_trader_42</p>
       </div>
       <div className="space-y-4">
          <h3 className="text-gray-500 font-bold text-xs uppercase tracking-wider px-2">Settings</h3>
          <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800">
             {[
               { icon: <Shield size={20}/>, label: "Security & Keys", value: "Standard" },
               { icon: <Activity size={20}/>, label: "Trading Limits", value: "$50k Daily" },
               { icon: <Plus size={20}/>, label: "Referral Program", value: "Earn BTC" }
             ].map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between border-b border-neutral-800 last:border-0 active:bg-neutral-800 cursor-pointer transition">
                   <div className="flex items-center gap-3">
                      <div className="text-gray-400">{item.icon}</div>
                      <span className="font-medium">{item.label}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-sm text-gray-500">{item.value}</span>
                     <ChevronRight className="w-4 h-4 text-gray-600" />
                   </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );

  // --- Main Render ---

  if (selectedStrategy) {
    return <StrategyDetail strategy={selectedStrategy} onBack={() => setSelectedStrategy(null)} />;
  }

  return (
    <div className="min-h-screen w-screen bg-black text-white font-sans flex flex-col">
      {/* Responsive Header / Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-neutral-900 transition-all duration-300 ${
          isDesktop ? 'bg-black/90 backdrop-blur-md h-20' : 'bg-black h-14 border-none'
      }`}>
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('trade')}>
             <div className="w-8 h-8 bg-[#00C805] rounded-lg flex items-center justify-center">
                <Activity size={20} className="text-black" />
             </div>
             <span className="font-bold text-xl tracking-tighter hidden md:block">QuantFlow</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <NavBtn label="Portfolio" active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} />
            <NavBtn label="Strategies" active={activeTab === 'strategies'} onClick={() => setActiveTab('strategies')} />
            <NavBtn label="Community" active={activeTab === 'community'} onClick={() => setActiveTab('community')} />
            <NavBtn label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          </div>

          {/* Mobile Profile Icon */}
          {!isDesktop && (
            <button onClick={() => setActiveTab('profile')} className="p-2">
              <User size={24} className={activeTab === 'profile' ? 'text-[#00C805]' : 'text-white'} />
            </button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className={`flex-1 ${isDesktop ? 'mt-24' : 'mt-14'} overflow-y-auto no-scrollbar`}>
         {activeTab === 'trade' && <TradeView />}
         {activeTab === 'strategies' && <StrategiesView />}
         {activeTab === 'community' && <CommunityView />}
         {activeTab === 'profile' && <ProfileView />}
      </main>

      {/* Mobile Bottom Navigation */}
      {!isDesktop && (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-800 pb-safe pt-2 z-50">
          <div className="flex justify-around items-center h-16">
            <MobNavBtn icon={<Activity size={22} />} label="Trade" active={activeTab === 'trade'} onClick={() => setActiveTab('trade')} />
            <MobNavBtn icon={<Layers size={22} />} label="Bots" active={activeTab === 'strategies'} onClick={() => setActiveTab('strategies')} />
            <MobNavBtn icon={<Globe size={22} />} label="Alpha" active={activeTab === 'community'} onClick={() => setActiveTab('community')} />
            <MobNavBtn icon={<User size={22} />} label="Me" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          </div>
        </div>
      )}
    </div>
  );
};

const NavBtn = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`text-sm font-bold transition-colors ${active ? 'text-[#00C805]' : 'text-gray-400 hover:text-white'}`}
  >
    {label}
  </button>
);

const MobNavBtn = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 w-20 transition-all ${active ? 'text-[#00C805] scale-110' : 'text-gray-500'}`}
  >
    {icon}
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

export default App;