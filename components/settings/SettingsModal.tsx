'use client';

import { Settings as SettingsIcon, User, Shield } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps) {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-black" />
          <span>Settings</span>
        </div>
      }
      showHeader={true}
      maxWidth="md"
    >

        {/* User Info */}
        {user && (
          <div className="p-4 border-b-2 border-black">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                {user.userPicture ? (
                  user.userPicture.startsWith('data:') ? (
                    <Image
                      src={user.userPicture}
                      alt={`${user.firstName} ${user.lastName}`}
                      fill
                      className="object-cover"
                      sizes="48px"
                      unoptimized
                    />
                  ) : (
                    <Image
                      src={user.userPicture}
                      alt={`${user.firstName} ${user.lastName}`}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )
                ) : (
                  <span className="text-lg font-bold text-white">
                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-black truncate">
                  {user.firstName} {user.lastName}
                </h3>
                <p className="text-sm text-gray-600 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Sections */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Account Settings */}
          <div className="border-2 border-black rounded-lg bg-white">
            <div className="p-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-black" />
                <h3 className="text-base font-bold text-black">Account</h3>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  onClose();
                  router.push('/profile/edit');
                }}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-black cursor-pointer"
              >
                Edit Profile
              </button>
              <button
                onClick={() => {
                  onClose();
                  router.push('/account-management');
                }}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-black cursor-pointer"
              >
                Account Management
              </button>
            </div>
          </div>

          {/* Privacy & Security */}
          <div className="border-2 border-black rounded-lg bg-white">
            <div className="p-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-black" />
                <h3 className="text-base font-bold text-black">Privacy & Security</h3>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  onClose();
                  router.push('/help');
                }}
                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-black cursor-pointer"
              >
                Help & Support
              </button>
            </div>
          </div>
        </div>
    </Modal>
  );
}

