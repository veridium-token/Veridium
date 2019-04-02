include Configfile

SHELL := /bin/bash

.EXPORT_ALL_VARIABLES:

TOKEN_FACTORY := token-factory
HELM_HOME := $(HOME)/.helm
BLOCKSTORAGE_SERVICE_NAME := block-storage
MONGO_SERVICE_NAME := mongodb
VERSION=1.0.0-$(COMMIT)


prereqs:
	curl -sL https://ibm.biz/idt-installer | bash -s install 

login:
	ibmcloud login -a https://api.us-east.bluemix.net --apikey $(IBMCLOUD_APIKEY)

configure:
	ibmcloud cs region-set $(REGION)
	ibmcloud cs cluster-config $(CLUSTER)

configure-helm:
	@echo "cluster [$(CLUSTER)]"
	@echo "kubeconfig [$(KUBECONFIG)]"
	curl -L  https://raw.githubusercontent.com/kubernetes/helm/master/scripts/get | bash -s  
	$(eval ROLE_BINDING_DEPLOYED := $(shell KUBECONFIG=$(KUBECONFIG) kubectl get clusterrolebinding kube-system:default  | wc -l | awk '{$$1=$$1};1' | tr -d ' '))
	@if [ "$(ROLE_BINDING_DEPLOYED)" = "0" ]; then\
		kubectl create clusterrolebinding kube-system:default --clusterrole=cluster-admin --serviceaccount=kube-system:default;\
	fi
	helm init --upgrade
	helm version
	helm repo add ibm  https://registry.bluemix.net/helm/ibm
	helm repo update

deploy-token-factory: deploy-mongodb
	$(eval TOKEN_FACTORY_DEPLOYED := $(shell KUBECONFIG=$(KUBECONFIG) HELM_HOME=$(HELM_HOME) helm list $(TOKEN_FACTORY)  | wc -l | awk '{$$1=$$1};1' | tr -d ' '))
	@echo "token factory deployed [$(TOKEN_FACTORY_DEPLOYED)]"
	$(eval JWT_SECRET_B64 := $(shell echo -n $(JWT_SECRET_PT) | base64))
	@echo "JWT_SECRET_B64 [$(JWT_SECRET_B64)]"
	helm package --app-version $(VERSION) --version $(VERSION) charts/incubator/token-factory
	@if [ "$(TOKEN_FACTORY_DEPLOYED)" = "0" ]; then\
		helm install --debug --name $(TOKEN_FACTORY) --set-string cluster=$(CLUSTER) --set-string jwt_secret=$(JWT_SECRET_B64) ./token-factory-$(VERSION).tgz;\
	else\
		helm upgrade --debug $(TOKEN_FACTORY) --set-string cluster=$(CLUSTER) --set-string jwt_secret=$(JWT_SECRET_B64) ./token-factory-$(VERSION).tgz;\
	fi

configure-blockstorage:
	$(eval BS_DEPLOYED := $(shell KUBECONFIG=$(KUBECONFIG) HELM_HOME=$(HELM_HOME) helm list $(BLOCKSTORAGE_SERVICE_NAME) | wc -l | awk '{$$1=$$1};1' | tr -d ' '))
	@if [ "$(BS_DEPLOYED)" = "0" ]; then\
		echo "installing helm chart $(BLOCKSTORAGE_SERVICE_NAME)";\
		helm install --debug --name $(BLOCKSTORAGE_SERVICE_NAME) ibm/ibmcloud-block-storage-plugin;\
	else\
		echo "upgrading helm chart $(BLOCKSTORAGE_SERVICE_NAME)";\
		helm upgrade --debug $(BLOCKSTORAGE_SERVICE_NAME) ibm/ibmcloud-block-storage-plugin;\
	fi

deploy-mongodb: configure-blockstorage
	$(eval MONGO_HELM_DEPLOYED := $(shell KUBECONFIG=$(KUBECONFIG) HELM_HOME=$(HELM_HOME) helm list $(MONGO_SERVICE_NAME)  | wc -l | awk '{$$1=$$1};1' | tr -d ' '))
	@echo "mongod deployed [$(MONGO_HELM_DEPLOYED)]"
	echo "usePassword: false" | tee -a mongodb-secure-overrides.yaml
#	echo "mongodbDatabase: token-factory" | tee -a mongodb-secure-overrides.yaml
#	echo "mongodbRootPassword: $(MONGO_ROOT_PWD)" | tee -a mongodb-secure-overrides.yaml
	echo "mongodbSystemLogVerbosity: $(MONGO_DB_LOG_VERBOSE)" | tee -a mongodb-secure-overrides.yaml
#	echo "mongodbUsername: $(MONGO_USER)" | tee -a mongodb-secure-overrides.yaml
#	echo "mongodbPassword: $(MONGO_PWD)" | tee -a mongodb-secure-overrides.yaml
	echo "replicaSet.key: $(MONGO_RS_KEY)" | tee -a mongodb-secure-overrides.yaml
	@if [ "$(MONGO_HELM_DEPLOYED)" = "0" ]; then\
		helm install --debug --name $(MONGO_SERVICE_NAME) stable/mongodb  -f mongodb-secure-overrides.yaml -f charts/stable/mongodb/chart-values.yaml;\
	else\
		helm upgrade --debug $(MONGO_SERVICE_NAME) stable/mongodb -f mongodb-secure-overrides.yaml -f charts/stable/mongodb/chart-values.yaml;\
	fi
	
clean:
	$(eval TOKEN_FACTORY_DEPLOYED := $(shell KUBECONFIG=$(KUBECONFIG) HELM_HOME=$(HELM_HOME) helm list $(TOKEN_FACTORY) | wc -l | awk '{$$1=$$1};1' | tr -d ' '))
	@if [ "$(TOKEN_FACTORY_DEPLOYED)" != "0" ]; then\
		helm delete $(TOKEN_FACTORY) --purge; \
	fi
	$(eval MONGO_HELM_DEPLOYED := $(shell KUBECONFIG=$(KUBECONFIG) HELM_HOME=$(HELM_HOME) helm list mongodb | wc -l | awk '{$$1=$$1};1' | tr -d ' '))
	@if [ "$(MONGO_HELM_DEPLOYED)" != "0" ]; then\
		helm delete $(MONGO_SERVICE_NAME) --purge; \
	fi
	$(eval BS_DEPLOYED := $(shell KUBECONFIG=$(KUBECONFIG) HELM_HOME=$(HELM_HOME) helm list $(BLOCKSTORAGE_SERVICE_NAME) | wc -l | awk '{$$1=$$1};1' | tr -d ' '))
	@if [ "$(BS_DEPLOYED)" != "0" ]; then\
		helm delete $(BLOCKSTORAGE_SERVICE_NAME) --purge; \
	fi

.PHONY: login
