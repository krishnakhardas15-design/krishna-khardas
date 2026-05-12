import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  MapPin, 
  Clock, 
  Calendar, 
  UtensilsCrossed, 
  CheckCircle2, 
  Loader2, 
  ChevronRight,
  TrendingUp,
  Package,
  History,
  Tag,
  Bell
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, FoodPost, OperationType } from '../types';
import { handleFirestoreError, cn, toDate } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface DonorDashboardProps {
  user: UserProfile;
}

export default function DonorDashboard({ user }: DonorDashboardProps) {
  const [showForm, setShowForm] = useState(false);
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    foodType: '',
    category: 'Vegetarian',
    quantity: '',
    pickupAddress: '',
    expiryTime: '',
    notes: ''
  });

  const categories = ["Vegetarian", "Non-Vegetarian", "Vegan", "Halal", "Jain", "Baked Goods", "Fruits/Veg"];

  useEffect(() => {
    const q = query(
      collection(db, 'foodPosts'),
      where('donorId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const newData = change.doc.data();
          const oldData = posts.find(p => p.id === change.doc.id);
          
          if (newData.status === 'claimed' && oldData?.status === 'pending') {
            toast.success(`Your ${newData.foodType} has been claimed!`, {
              description: 'A receiver will arrive soon for pickup.',
              icon: <Bell className="w-5 h-5 text-emerald-600" />,
              duration: 5000
            });
          }
        }
      });

      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FoodPost[];
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'foodPosts');
    });

    return () => unsubscribe();
  }, [user.id, posts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Try to get geolocation
      let latitude = 0;
      let longitude = 0;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (geoError) {
        console.warn('Geolocation failed, falling back to 0,0', geoError);
      }

      const newPost = {
        donorId: user.id,
        donorName: user.full_name,
        foodType: formData.foodType,
        category: formData.category,
        quantity: parseInt(formData.quantity),
        pickupAddress: formData.pickupAddress,
        latitude,
        longitude,
        expiryTime: new Date(formData.expiryTime),
        notes: formData.notes,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'foodPosts'), newPost);
      toast.success('Donation posted successfully!');
      setShowForm(false);
      setFormData({
        foodType: '',
        category: 'Vegetarian',
        quantity: '',
        pickupAddress: '',
        expiryTime: '',
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'foodPosts');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'claimed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'expired': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const metrics = [
    { label: 'Total Donations', value: posts.length, icon: Package, color: 'text-indigo-600' },
    { label: 'Pending', value: posts.filter(p => p.status === 'pending').length, icon: Clock, color: 'text-amber-600' },
    { label: 'Claimed', value: posts.filter(p => p.status === 'claimed').length, icon: CheckCircle2, color: 'text-blue-600' },
    { label: 'Delivered', value: posts.filter(p => p.status === 'delivered').length, icon: TrendingUp, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Metrics Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white/50 backdrop-blur-xl p-5 rounded-[2rem] border border-white/60 shadow-xl shadow-emerald-900/5 flex items-center gap-4 group hover:shadow-2xl transition-all duration-300">
            <div className={cn("p-3 rounded-2xl bg-white/50", m.color.replace('text', 'text'))}>
              <m.icon className={cn("w-6 h-6", m.color)} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">{m.label}</p>
              <p className="text-2xl font-black text-slate-800 tracking-tight">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "w-full flex items-center justify-center gap-3 py-5 rounded-[2rem] font-black tracking-wide transition-all shadow-xl active:scale-[0.98] text-lg",
            showForm 
              ? "bg-white/60 backdrop-blur-md text-slate-600 border border-white/80" 
              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20 hover:shadow-emerald-600/30"
          )}
        >
          {showForm ? 'Discard Draft' : (
            <>
              <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                <PlusCircle className="w-6 h-6" />
              </div>
              Donate Surplus Food
            </>
          )}
        </button>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleSubmit} className="bg-white/60 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/80 shadow-2xl space-y-6 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 ml-2 uppercase tracking-widest">Food Item Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Veg Biryani, Fruit Basket"
                      className="w-full bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
                      value={formData.foodType}
                      onChange={e => setFormData({ ...formData, foodType: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 ml-2 uppercase tracking-widest">Category</label>
                    <div className="relative">
                      <select
                        required
                        className="w-full bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-11 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold appearance-none"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 ml-2 uppercase tracking-widest">Portion Size</label>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        placeholder="e.g. 50"
                        className="w-full bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase">Servings</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 ml-2 uppercase tracking-widest">Pickup Address</label>
                    <div className="relative">
                      <input
                        required
                        type="text"
                        placeholder="Location details"
                        className="w-full bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-11 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
                        value={formData.pickupAddress}
                        onChange={e => setFormData({ ...formData, pickupAddress: e.target.value })}
                      />
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 ml-2 uppercase tracking-widest">Expiry Time</label>
                    <div className="relative">
                      <input
                        required
                        type="datetime-local"
                        className="w-full bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-11 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold"
                        value={formData.expiryTime}
                        onChange={e => setFormData({ ...formData, expiryTime: e.target.value })}
                      />
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 relative z-10">
                  <label className="text-xs font-black text-slate-500 ml-2 uppercase tracking-widest">Special Instructions</label>
                  <textarea
                    placeholder="e.g. Needs refrigeration, contains nuts"
                    className="w-full bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold placeholder:font-medium placeholder:text-slate-300 h-28"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <button
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4.5 rounded-[2rem] transition-all shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 relative z-10"
                >
                  {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      Post Donation
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <div className="bg-emerald-100 p-2 rounded-xl">
              <History className="w-6 h-6 text-emerald-600" />
            </div>
            Recent History
          </h2>
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-white/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/50">{posts.length} entries</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white/30 backdrop-blur-md rounded-[2.5rem] border border-white/40 border-dashed">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
            <p className="text-emerald-900/60 font-bold tracking-widest uppercase text-[10px]">Synchronizing...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white/40 backdrop-blur-xl p-16 rounded-[2.5rem] border border-white/50 shadow-xl text-center">
            <div className="bg-emerald-50 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
              <UtensilsCrossed className="w-10 h-10 text-emerald-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">No donations yet</h3>
            <p className="text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">Your generosity starts here. Click the button above to post your first surplus meal.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {posts.map((post) => (
              <motion.div
                layout
                key={post.id}
                className="bg-white/70 backdrop-blur-md p-6 rounded-[2.25rem] border border-white/80 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full -mr-12 -mt-12 group-hover:bg-emerald-100/50 transition-colors duration-500" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-5">
                    <div className="bg-white/80 p-3 rounded-2xl shadow-sm border border-slate-50 group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:text-white transition-all duration-300">
                      <Package className="w-6 h-6" />
                    </div>
                    <span className={cn("text-[9px] px-2.5 py-1 rounded-full font-black border uppercase tracking-[0.15em] shadow-sm", getStatusColor(post.status))}>
                      {post.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors line-clamp-1">{post.foodType}</h3>
                  <div className="flex flex-col gap-2 text-slate-500 mb-6">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{post.pickupAddress}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                      <span>{post.quantity} servings</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-5 border-t border-slate-100/50">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <Calendar className="w-3.5 h-3.5" />
                      {toDate(post.expiryTime) ? format(toDate(post.expiryTime)!, 'MMM d, h:mm a') : '---'}
                    </div>
                    <div className="text-[10px] font-black text-emerald-600/40 uppercase tracking-tighter">
                      {toDate(post.createdAt) ? format(toDate(post.createdAt)!, 'HH:mm') : ''}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Component logic continues...
