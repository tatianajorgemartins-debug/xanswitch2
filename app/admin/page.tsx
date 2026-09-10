import { redirect } from 'next/navigation';
import { getAllGames, getMusicSettings, getVisitCount, getAllReviews, getRecentOrders } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // this is the real, authoritative check — the proxy only does a cheap
  // "is there a cookie at all" pass to bounce obviously logged-out visitors
  const authed = await isAuthenticated();
  if (!authed) {
    redirect('/admin/login');
  }

  const games = await getAllGames();
  const music = await getMusicSettings();
  const visitCount = await getVisitCount();
  const reviews = await getAllReviews();
  const orders = await getRecentOrders();
  return (
    <AdminClient
      initialGames={games}
      music={music}
      visitCount={visitCount}
      reviews={reviews}
      orders={orders}
    />
  );
}
