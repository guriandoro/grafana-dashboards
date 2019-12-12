import React, { ReactElement, useState } from 'react';
import './AddRemoteInstance.scss';
import { InputField } from '../../../react-plugins-deps/components/FieldsComponents/Input/Input';
import { TextAreaField } from '../../../react-plugins-deps/components/FieldsComponents/TextArea/TextArea';
import { CheckboxField } from '../../../react-plugins-deps/components/FieldsComponents/Checkbox/Checkbox';

import { Form as FormFinal } from 'react-final-form';
import { useForm } from 'react-final-form-hooks';
import { PasswordField } from '../../../react-plugins-deps/components/FieldsComponents/Password/Password';
import AddRemoteInstanceService from 'pmm-add-instance-app-panel/AddInstance/AddRemoteInstance/AddRemoteInstanceService';
import Validators from '../../../react-plugins-deps/components/validators/validators';

interface InstanceData {
  instanceType?: string;
  defaultPort?: number;
  remoteInstanceCredentials?: any;
  discoverName?: string;
}

const extractCredentials = credentials => {
  return {
    service_name: credentials.address,
    port: credentials.port,
    address: credentials.address,
    isRDS: credentials.isRDS,
    region: credentials.region,
    aws_access_key: credentials.aws_access_key,
    aws_secret_key: credentials.aws_secret_key,
    instance_id: credentials.instance_id,
    az: credentials.az,
  };
};
const getInstanceData = (instanceType, credentials) => {
  const instance: InstanceData = {};
  instance.remoteInstanceCredentials = credentials ? extractCredentials(credentials) : {};
  switch (instanceType) {
    case 'postgresql':
      instance.instanceType = 'PostgreSQL';
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 5432;
      break;
    case 'mysql':
      instance.instanceType = 'MySQL';
      instance.discoverName = 'DISCOVER_RDS_MYSQL';
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 3306;
      break;
    case 'mongodb':
      instance.instanceType = 'MongoDB';
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 27017;
      break;
    case 'proxysql':
      instance.instanceType = 'ProxySQL';
      instance.remoteInstanceCredentials.port = instance.remoteInstanceCredentials.port || 6032;
      break;
  }

  return instance;
};

const getAdditionalOptions = (type, form) => {
  switch (type) {
    case 'PostgreSQL':
      return (
        <>
          <CheckboxField form={form} label={'Use Pg Stat Statements'} name="qan_postgresql_pgstatements_agent" />
          <span className="description"></span>
        </>
      );
    case 'MySQL':
      return (
        <>
          <CheckboxField form={form} label={'Use performance schema'} name="qan_mysql_perfschema" />
          <span className="description"></span>
        </>
      );
    case 'MongoDB':
      return (
        <>
          <CheckboxField form={form} label={'Use QAN MongoDB Profiler'} name="qan_mongodb_profiler" />
          <span className="description"></span>
        </>
      );
    default:
      return null;
  }
};

const validateInstanceForm = values => {
  const errors = {} as any;

  errors.port = values.port ? Validators.validatePort(values.port) : '';
  errors.custom_labels = values.custom_labels ? Validators.validateKeyValue(values.custom_labels) : '';
  for (const propName in errors) {
    if (!errors[propName]) {
      delete errors[propName];
    }
  }
  return errors;
};
const AddRemoteInstance = props => {
  const { instanceType, remoteInstanceCredentials, discoverName } = getInstanceData(props.instance.type, props.instance.credentials);
  const [loading, setLoading] = useState<boolean>(false);
  const initialValues = { ...remoteInstanceCredentials };
  if (instanceType === 'MySQL') {
    initialValues.qan_mysql_perfschema = true;
  }

  const onSubmit = async values => {
    const currentUrl = `${window.parent.location}`;
    const newURL = currentUrl.split('/graph/d/').shift() + '/graph/d/pmm-inventory/';

    const data = Object.assign({}, values);
    if (values.custom_labels) {
      data.custom_labels = data.custom_labels
        .split(/[\n\s]/)
        .filter(Boolean)
        .reduce((acc, val) => {
          const [key, value] = val.split(':');
          acc[key] = value;
          return acc;
        }, {});
    }

    if (data.add_node === undefined) {
      data.add_node = {
        node_name: data.service_name,
        node_type: 'REMOTE_NODE',
      };
    }

    if (discoverName) {
      data.engine = discoverName;
    }

    if (data.pmm_agent_id === undefined || data.pmm_agent_id === '') {
      data.pmm_agent_id = 'pmm-server'; // set default value for pmm agent id
    }

    setLoading(true);

    try {
      if (values.isRDS) {
        data.rds_exporter = true;
        await AddRemoteInstanceService.addRDS(data);
      } else {
        // remove rds fields from data
        await AddRemoteInstanceService.addRemote(instanceType, data);
      }
      setLoading(false);
      window.location.assign(newURL);
    } catch (e) {
      setLoading(false);
    }
  };
  // @ts-ignore
  return (
    <FormFinal
      onSubmit={() => {}}
      render={(): ReactElement => {
        const { form, handleSubmit } = useForm({
          onSubmit: onSubmit,
          validate: validateInstanceForm,
          initialValues: initialValues,
        });
        // @ts-ignore
        return (
          <form onSubmit={handleSubmit} className="add-instance-form app-theme-dark">
            <h5>{`Add remote ${instanceType} Instance`}</h5>
            <div className="add-instance-panel">
              <h6>Main details</h6>
              <span></span>
              <InputField form={form} name="address" placeholder="*Hostname" required={true} />
              <span className="description">Public DNS hostname of your instance</span>

              <InputField form={form} name="service_name" placeholder="Service name (default: Hostname)" />
              <span className="description">Service name to use.</span>

              <InputField form={form} name="port" placeholder={`Port (default: ${remoteInstanceCredentials.port} )`} required={true} />
              <span className="description">Port your service is listening on</span>
            </div>
            <div className="add-instance-panel">
              <InputField form={form} name="username" placeholder="*Username" required={true} />
              <span className="description">Your database user name</span>

              <PasswordField form={form} name="password" placeholder="*Password" required={true} />
              <span className="description">Your database password</span>
              {/*// TODO: remove hardcode and add real check*/}
              {props.instance.type === 'mysql' ? (
                <>
                  <CheckboxField form={form} label={'RDS database'} name="isRDS" />
                  <span className="description"></span>
                </>
              ) : null}
              {form.getFieldState('isRDS') && (form.getFieldState('isRDS') as any).value ? (
                <>
                  <InputField form={form} name="aws_access_key" placeholder="AWS_ACCESS_KEY" required={true} />
                  <span className="description">AWS access key</span>

                  <PasswordField form={form} name="aws_secret_key" placeholder="AWS_SECRET_KEY" required={true} />
                  <span className="description">AWS secret key</span>

                  <InputField form={form} name="instance_id" placeholder="Instance ID" required={true} />
                  <span className="description">Instance ID</span>
                </>
              ) : null}
            </div>
            <div className="add-instance-panel">
              <h6>Labels</h6>
              <span></span>
              <InputField form={form} name="environment" placeholder="Environment" />
              <span className="description"></span>

              <InputField form={form} name="region" placeholder="Region" />
              <span className="description">Region</span>

              <InputField form={form} name="az" required={true} placeholder="Availability Zone" />
              <span className="description">Availability Zone</span>

              <InputField form={form} name="replication_set" placeholder="Replication set" />
              <span className="description"></span>

              <InputField form={form} name="cluster" placeholder="Cluster" />
              <span className="description"></span>

              <TextAreaField
                form={form}
                name="custom_labels"
                placeholder="Custom labels
Format:
key1:value1
key2:value2"
              />
              <span className="description"></span>
            </div>
            <div className="add-instance-panel">
              <h6>Additional options</h6>
              <span></span>
              <CheckboxField form={form} label={'Skip connection check'} name="skip_connection_check" />

              <span className="description"></span>

              <CheckboxField form={form} label={'Use TLS for database connections'} name="tls" />

              <span className="description"></span>
              <CheckboxField
                form={form}
                label={'Skip TLS certificate and hostname validation'}
                name="tls_skip_verify"
                data-cy="add-account-username"
              />
              <span className="description"></span>
              {getAdditionalOptions(instanceType, form)}
            </div>

            <div className="add-instance-form__submit-block">
              <button type="submit" className="button button--dark" id="addInstance" disabled={loading}>
                Add service
              </button>
            </div>
          </form>
        );
      }}
    />
  );
};

export default AddRemoteInstance;