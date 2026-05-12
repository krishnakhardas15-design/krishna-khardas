import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Clock, 
  Calendar, 
  UtensilsCrossed, 
  CheckCircle2, 
  Loader2, 
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  Navigation,
  Package,
  Bell,
  Map as MapIcon,
  List as ListIcon
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, FoodPost, OperationType } from '../types';
import { handleFirestoreError, cn, toDate } from '../lib/utils';
import { format, isBefore, addHours } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY);

interface ReceiverFeedProps {
  user: UserProfile;
}

interface MarkerWithInfoWindowProps { 
  post: FoodPost; 
  onClaim: (id: string) => void; 
  onDeliver: (id: string) => void;
  tab: string;
  actionLoading: string | null;
  key?: React.Key;
}

function MarkerWithInfoWindow({ post, onClaim, onDeliver, tab, actionLoading }: MarkerWithInfoWindowProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: post.latitude || 0, lng: post.longitude || 0 }}
        onClick={() => setOpen(true)}
      >
        <Pin 
          background={post.status === 'pending' ? "#10b981" : "#3b82f6"} 
          glyphColor="#fff" 
          borderColor="#fff"
        />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-2 max-w-[240px] space-y-3">
            <div className="space-y-1">
              <h4 className="font-black text-slate-800 leading-tight">{post.foodType}</h4>
              <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">{post.category}</p>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Package className="w-3.5 h-3.5" />
              <span>{post.quantity} servings</span>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              {tab === 'available' ? (
                <button
                  onClick={() => onClaim(post.id)}
                  disabled={!!actionLoading}
                  className="w-full bg-emerald-600 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50"
                >
                  {actionLoading === post.id ? 'Claiming...' : 'Claim Now'}
                </button>
              ) : post.status === 'claimed' && (
                <button
                  onClick={() => onDeliver(post.id)}
                  disabled={!!actionLoading}
                  className="w-full bg-blue-600 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 disabled:opacity-50"
                >
                  {actionLoading === post.id ? 'Updating...' : 'Received'}
                </button>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.pickupAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-100 text-slate-600 text-center font-black py-2 rounded-xl text-[10px] uppercase tracking-widest"
              >
                Directions
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default function ReceiverFeed({ user }: ReceiverFeedProps) {
  const [feed, setFeed] = useState<FoodPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'available' | 'claimed'>('available');
  const [viewType, setViewType] = useState<'list' | 'map'>('list');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [maxDistance, setMaxDistance] = useState(10); // 10km default
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);

  const categories = ["All", "Vegetarian", "Non-Vegetarian", "Vegan", "Halal", "Jain", "Baked Goods", "Fruits/Veg"];

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn('Geolocation denied', err)
    );
  }, []);

  useEffect(() => {
    let q;
    if (tab === 'available') {
      q = query(
        collection(db, 'foodPosts'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'foodPosts'),
        where('claimedBy', '==', user.id),
        orderBy('updatedAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Notification logic for new posts
      if (tab === 'available') {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && !loading) {
            const post = change.doc.data() as FoodPost;
            
            // Check proximity if coordinates available
            let isNear = true;
            if (userCoords && post.latitude && post.longitude) {
              const dist = calculateDistance(userCoords.lat, userCoords.lng, post.latitude, post.longitude);
              isNear = dist <= maxDistance;
            }

            if (isNear) {
              toast.info(`New surplus food: ${post.foodType}`, {
                description: `A new donation was posted in your vicinity.`,
                icon: <Bell className="w-5 h-5 text-emerald-600" />,
                action: {
                  label: 'View',
                  onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
                }
              });
            }
          }
        });
      }

      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FoodPost[];
      setFeed(postsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'foodPosts');
    });

    return () => unsubscribe();
  }, [tab, user.id, userCoords, maxDistance, loading]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredFeed = feed.filter(post => {
    // Search Query
    const matchesSearch = post.foodType.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         post.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category Filter
    const matchesCategory = categoryFilter === 'All' || post.category === categoryFilter;

    // Distance Filter
    let matchesDistance = true;
    if (userCoords && post.latitude && post.longitude && tab === 'available') {
      const dist = calculateDistance(userCoords.lat, userCoords.lng, post.latitude, post.longitude);
      matchesDistance = dist <= maxDistance;
    }

    return matchesSearch && matchesCategory && matchesDistance;
  });

  const claimPost = async (postId: string) => {
    setActionLoading(postId);
    try {
      // 1. Update post status
      await updateDoc(doc(db, 'foodPosts', postId), {
        status: 'claimed',
        claimedBy: user.id,
        updatedAt: serverTimestamp()
      });

      // 2. Add to claims collection (optional, following schema)
      await addDoc(collection(db, 'claims'), {
        foodPostId: postId,
        receiverId: user.id,
        createdAt: serverTimestamp()
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `foodPosts/${postId}`);
    } finally {
      setActionLoading(null);
    }
  };

  const deliverPost = async (postId: string) => {
    setActionLoading(postId);
    try {
      await updateDoc(doc(db, 'foodPosts', postId), {
        status: 'delivered',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `foodPosts/${postId}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex bg-white/40 backdrop-blur-md p-2 rounded-[2.5rem] border border-white/60 shadow-lg sticky top-[80px] z-40 transition-all duration-300">
          <button
            onClick={() => setTab('available')}
            className={cn(
              "flex-1 py-4 px-6 rounded-[2rem] font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3",
              tab === 'available' 
                ? "bg-emerald-600 text-white shadow-xl shadow-emerald-600/30" 
                : "text-slate-400 hover:text-slate-800 hover:bg-white/40"
            )}
          >
            <UtensilsCrossed className="w-5 h-5" />
            Marketplace
          </button>
          <button
            onClick={() => setTab('claimed')}
            className={cn(
              "flex-1 py-4 px-6 rounded-[2rem] font-black text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-3",
              tab === 'claimed' 
                ? "bg-emerald-600 text-white shadow-xl shadow-emerald-600/30" 
                : "text-slate-400 hover:text-slate-800 hover:bg-white/40"
            )}
          >
            <ShieldCheck className="w-5 h-5" />
            My Claims
          </button>
        </div>

        {/* Filters */}
        {tab === 'available' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search food by name or location..." 
                  className="w-full bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <select 
                    className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl px-10 py-3 text-xs font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none shadow-sm"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                </div>
                <div className="relative">
                  <select 
                    className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl px-10 py-3 text-xs font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none shadow-sm"
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                  >
                    <option value={5}>5 km</option>
                    <option value={10}>10 km</option>
                    <option value={20}>20 km</option>
                    <option value={50}>50 km</option>
                  </select>
                  <MapIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                </div>
                <button
                  onClick={() => setViewType(viewType === 'list' ? 'map' : 'list')}
                  className={cn(
                    "bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl px-4 py-3 shadow-sm transition-all flex items-center justify-center translate-y-0 active:translate-y-0.5",
                    viewType === 'map' ? "text-emerald-600" : "text-slate-400"
                  )}
                  title={viewType === 'list' ? 'Switch to Map View' : 'Switch to List View'}
                >
                  {viewType === 'list' ? <MapIcon className="w-5 h-5" /> : <ListIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={cn(
                    "whitespace-nowrap px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                    categoryFilter === c 
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200" 
                      : "bg-white/40 text-slate-400 border-white/60 hover:bg-white/60"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white/30 backdrop-blur-md rounded-[3rem] border border-white/40 border-dashed">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-6" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-emerald-100 rounded-full opacity-20" />
          </div>
          <p className="text-emerald-900 font-black tracking-[0.2em] uppercase text-xs">Curating Fresh Surplus...</p>
        </div>
      ) : viewType === 'map' ? (
        <div className="h-[500px] w-full rounded-[3rem] overflow-hidden border border-white/60 shadow-2xl relative">
          <AnimatePresence>
            {!hasValidKey && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex items-center justify-center p-8 text-center"
              >
                <div className="max-w-md">
                  <MapIcon className="w-16 h-16 text-emerald-600 mx-auto mb-6" />
                  <h2 className="text-2xl font-black text-slate-800 mb-4">Google Maps API Key Required</h2>
                  <p className="text-slate-500 font-medium mb-6">Visual tracking is disabled. To activate maps, please configure your API key in the project settings.</p>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left text-xs space-y-2">
                    <p><strong>To add your API key:</strong></p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-400">
                      <li>Get an API key from Google Cloud Console</li>
                      <li>Open <strong>Settings</strong> (⚙️ icon) → <strong>Secrets</strong></li>
                      <li>Add <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {hasValidKey && (
            <APIProvider apiKey={API_KEY} version="weekly">
              <Map
                defaultCenter={userCoords || { lat: 20.5937, lng: 78.9629 }}
                defaultZoom={userCoords ? 13 : 5}
                mapId="AN_SEVA_MAP"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                className="w-full h-full"
                gestureHandling={'greedy'}
              >
                {filteredFeed.map(post => (
                  <MarkerWithInfoWindow 
                    key={post.id} 
                    post={post} 
                    onClaim={claimPost} 
                    onDeliver={deliverPost}
                    tab={tab}
                    actionLoading={actionLoading}
                  />
                ))}
              </Map>
            </APIProvider>
          )}
        </div>
      ) : filteredFeed.length === 0 ? (
        <div className="bg-white/40 backdrop-blur-xl p-20 rounded-[3rem] border border-white/60 shadow-2xl text-center">
          <div className="bg-slate-50 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Search className="w-12 h-12 text-slate-200" />
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Nothing here yet</h3>
          <p className="text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">
            {tab === 'available' 
              ? "No available food matches your filters. Try widening your search!" 
              : "Your claim history is empty. Start by browsing the marketplace."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredFeed.map((post) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={post.id}
                className="bg-white/70 backdrop-blur-lg p-8 rounded-[2.5rem] border border-white/80 shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 relative overflow-hidden group"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-50 rounded-full -mr-20 -mt-20 group-hover:bg-emerald-100/60 transition-all duration-700 blur-2xl" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                          {post.status === 'pending' ? 'Active' : post.status}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 leading-tight tracking-tight group-hover:text-emerald-800 transition-colors">{post.foodType}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{post.category}</p>
                    </div>
                    <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-slate-50 group-hover:rotate-12 transition-transform duration-500">
                      <Package className="w-7 h-7 text-emerald-600" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 mb-8">
                    <div className="flex items-center gap-3 text-slate-600 bg-white/40 p-2.5 rounded-2xl border border-white/50">
                      <div className="bg-white/80 p-2 rounded-xl shadow-sm">
                        <Package className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-sm font-black tracking-tight">{post.quantity} servings available</span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-slate-600 bg-white/40 p-2.5 rounded-2xl border border-white/50">
                      <div className="bg-white/80 p-2 rounded-xl shadow-sm">
                        <Clock className="w-4 h-4 text-amber-500" />
                      </div>
                      <span className="text-sm font-black tracking-tight">Best before {toDate(post.expiryTime) ? format(toDate(post.expiryTime)!, 'h:mm a') : 'Soon'}</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-600 bg-white/40 p-2.5 rounded-2xl border border-white/50">
                      <div className="bg-white/80 p-2 rounded-xl shadow-sm shrink-0">
                        <MapPin className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black tracking-tight truncate max-w-[150px]">{post.pickupAddress}</span>
                        {userCoords && post.latitude && post.longitude && (
                          <span className="text-[9px] font-black text-emerald-600 uppercase">
                            {calculateDistance(userCoords.lat, userCoords.lng, post.latitude, post.longitude).toFixed(1)} km away
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {post.notes && (
                    <div className="mb-8 p-5 bg-amber-50/40 backdrop-blur-sm rounded-[1.5rem] border border-amber-100/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Donor Notes</p>
                      </div>
                      <p className="text-sm text-slate-600 font-medium italic leading-relaxed">"{post.notes}"</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.pickupAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-white/80 hover:bg-white text-slate-600 font-black rounded-2xl transition-all border border-slate-100 text-xs tracking-widest uppercase shadow-sm active:scale-95"
                    >
                      <Navigation className="w-4 h-4" />
                      Route
                    </a>

                    {tab === 'available' ? (
                      <button
                        onClick={() => claimPost(post.id)}
                        disabled={!!actionLoading}
                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4.5 px-8 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-sm tracking-widest uppercase"
                      >
                        {actionLoading === post.id ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-6 h-6" />
                            Claim Food
                          </>
                        )}
                      </button>
                    ) : post.status === 'claimed' && (
                      <button
                        onClick={() => deliverPost(post.id)}
                        disabled={!!actionLoading}
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4.5 px-8 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 text-sm tracking-widest uppercase"
                      >
                        {actionLoading === post.id ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <ShieldCheck className="w-6 h-6" />
                            Received
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Component logic continues...
