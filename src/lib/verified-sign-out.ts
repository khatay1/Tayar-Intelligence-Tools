export async function verifiedSignOut(auth: {
  signOut(): Promise<{ error: { message: string } | null }>;
}): Promise<void> {
  const { error } = await auth.signOut();
  if (error) throw new Error(error.message);
}
