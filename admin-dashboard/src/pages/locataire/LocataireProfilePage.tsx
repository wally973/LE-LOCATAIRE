import React, { useCallback } from 'react';
import { tenantApi } from '@services/tenantApi';
import { locataireApi } from '@services/locataireApi';
import { getErrorMessage } from '@services/apiClient';
import {
  ProfileForm,
  type ProfileFormValues,
} from '@components/locataire/ProfileForm';

const LocataireProfilePage: React.FC = () => {
  const loadProfile = useCallback(async (): Promise<ProfileFormValues> => {
    const u = await tenantApi.getMe();
    const user = u as {
      email?: string | null;
      phone?: string;
      tenant?: { firstName?: string; lastName?: string };
    };
    return {
      email: user.email ?? '',
      phone: user.phone ?? '',
      firstName: user.tenant?.firstName ?? '',
      lastName: user.tenant?.lastName ?? '',
      currentPassword: '',
      newPassword: '',
    };
  }, []);

  const onSave = useCallback(async (values: ProfileFormValues) => {
    const body: Record<string, unknown> = {
      email: values.email,
      phone: values.phone,
      firstName: values.firstName,
      lastName: values.lastName,
    };
    if (values.newPassword) {
      body.currentPassword = values.currentPassword;
      body.newPassword = values.newPassword;
    }
    try {
      await locataireApi.updateTenantProfile(body);
    } catch (e) {
      throw new Error(getErrorMessage(e, 'Sauvegarde impossible'));
    }
  }, []);

  return (
    <div className="container">
      <h1>Mon profil</h1>
      <ProfileForm loadProfile={loadProfile} onSave={onSave} />
    </div>
  );
};

export default LocataireProfilePage;
